import { test, expect } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';

test.describe('@llm playground', () => {
  test.skip(!process.env.OPENAI_API_KEY, 'requires OPENAI_API_KEY env var');

  // The Playground needs an agent in the current project. Agents only exist once a call has
  // been ingested, so this project depends on llm-ingestion (wired in playwright.config.ts).
  test.beforeEach(async ({ request }) => {
    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);
    const { items: agents } = await api.listAgents();
    expect(agents.length, 'need at least one agent — run ingestion spec first').toBeGreaterThan(0);
  });

  test('pick agent + endpoint, send a prompt → assistant reply renders with stats', async ({ page, request }) => {
    test.setTimeout(120_000);

    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);
    const { items: agents } = await api.listAgents();
    const agent = agents[0];

    await page.goto('/playground', { waitUntil: 'load' });
    await expect(page.getByTestId('playground')).toBeVisible({ timeout: 10_000 });

    // AgentPicker → choose the ingested agent.
    await page.getByTestId('agent-picker').click();
    await page.getByTestId(`agent-picker-option-${agent.id}`).click();

    // ComposeBox is enabled once an agent is selected; EndpointPicker shows the endpoint.
    const compose = page.getByTestId('compose-box');
    await expect(compose).toBeEnabled({ timeout: 10_000 });
    await expect(page.getByTestId('endpoint-picker')).toBeVisible();

    // Send a prompt.
    await compose.fill('Reply with exactly: pong');
    await page.getByTestId('compose-send').click();

    // Assistant reply renders in the ConversationView (user + assistant bubbles).
    const conversation = page.getByTestId('conversation-view');
    await expect(conversation).toBeVisible();
    await expect(
      conversation.locator('[data-testid^="editable-message-bubble-"][data-role="assistant"]'),
    ).toHaveCount(1, { timeout: 90_000 });

    // CompletionStats shows token usage + latency once the stream finishes.
    const stats = page.getByTestId('completion-stats');
    await expect(stats).toBeVisible();
    await expect(stats).toContainText('Input', { timeout: 90_000 });
    await expect(stats).toContainText('Latency', { timeout: 90_000 });
  });

  test('AddMessageBar adds a follow-up turn → multi-turn conversation', async ({ page, request }) => {
    test.setTimeout(120_000);

    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);
    const { items: agents } = await api.listAgents();
    const agent = agents[0];

    await page.goto('/playground', { waitUntil: 'load' });
    await page.getByTestId('agent-picker').click();
    await page.getByTestId(`agent-picker-option-${agent.id}`).click();

    const compose = page.getByTestId('compose-box');
    await expect(compose).toBeEnabled({ timeout: 10_000 });
    await compose.fill('Reply with exactly: one');
    await page.getByTestId('compose-send').click();

    const conversation = page.getByTestId('conversation-view');
    await expect(
      conversation.locator('[data-testid^="editable-message-bubble-"][data-role="assistant"]'),
    ).toHaveCount(1, { timeout: 90_000 });

    const bubblesBefore = await conversation
      .locator('[data-testid^="editable-message-bubble-"]')
      .count();

    // AddMessageBar → add a manual user turn. This inserts a new bubble immediately.
    await page.getByTestId('add-message-bar').first().click();
    await page.getByTestId('add-message-role-user').click();

    await expect(
      conversation.locator('[data-testid^="editable-message-bubble-"]'),
    ).toHaveCount(bubblesBefore + 1);
  });

  test('temperature ParameterSlider change is reflected in the override state', async ({ page, request }) => {
    test.setTimeout(60_000);

    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);
    const { items: agents } = await api.listAgents();
    const agent = agents[0];

    await page.goto('/playground', { waitUntil: 'load' });
    await page.getByTestId('agent-picker').click();
    await page.getByTestId(`agent-picker-option-${agent.id}`).click();
    await expect(page.getByTestId('compose-box')).toBeEnabled({ timeout: 10_000 });

    // Open the parameters drawer on the RightRail and change the temperature.
    await page.getByRole('button', { name: 'Parameters' }).click();
    const slider = page.getByTestId('parameter-slider-temperature');
    await expect(slider).toBeVisible();
    await slider.fill('1.5');

    // The change is reflected in the slider's value (the override the request payload uses).
    await expect(slider).toHaveValue('1.5');
  });

  test('EditableMessageBubble edits a prior user message before re-sending', async ({ page, request }) => {
    test.setTimeout(120_000);

    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);
    const { items: agents } = await api.listAgents();
    const agent = agents[0];

    await page.goto('/playground', { waitUntil: 'load' });
    await page.getByTestId('agent-picker').click();
    await page.getByTestId(`agent-picker-option-${agent.id}`).click();

    const compose = page.getByTestId('compose-box');
    await expect(compose).toBeEnabled({ timeout: 10_000 });
    await compose.fill('original message');
    await page.getByTestId('compose-send').click();

    const conversation = page.getByTestId('conversation-view');
    const userBubble = conversation
      .locator('[data-testid^="editable-message-bubble-"][data-role="user"]')
      .first();
    await expect(userBubble).toContainText('original message', { timeout: 90_000 });

    // Hover to reveal the edit control, edit the content, and save.
    await userBubble.hover();
    await userBubble.getByTestId('editable-message-edit').click();
    const input = userBubble.getByTestId('editable-message-input');
    await input.fill('edited message');
    await userBubble.getByTestId('editable-message-save').click();

    await expect(userBubble).toContainText('edited message');
  });
});
