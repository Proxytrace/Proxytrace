import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// Covers Tracey's progressive tool disclosure end to end: a gated read forces a `load_skill`
// first, the skill's tools then stay unlocked for the REST of the conversation (no re-load on the
// next turn), and the inline entity cards render from the artifact store. Real LLM turns, so
// @llm-gated; the assistant's exact tool choice is non-deterministic, so prompts are explicit and
// assertions target the cards/tool calls she must produce either way.
test.describe('@llm Tracey skills & cards', () => {
  test.skip(!process.env.OPENAI_API_KEY, 'requires OPENAI_API_KEY env var');

  let api: ProxytraceApiClient;
  let agentName: string;
  let suiteName: string;

  test.beforeEach(async ({ request }) => {
    api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);

    const endpointId = await api.firstEndpointId();
    const projectId = await api.firstProjectId();

    // Self-seeded, uniquely named data so the spec depends on no other spec and Tracey's tool
    // calls are unambiguous.
    const stamp = Date.now();
    agentName = `E2E Skill Agent ${stamp}`;
    suiteName = `E2E Skill Suite ${stamp}`;
    const agent = await api.createAgent({ name: agentName, endpointId, projectId });
    const { id: evaluatorId } = await api.createEvaluator(projectId);
    await api.createTestSuite(suiteName, agent.id, [evaluatorId], [
      { userContent: 'Reply with exactly: pong', expectedContent: 'pong' },
    ]);
  });

  /** Sends a chat message and waits for the assistant turn to finish (status bar count grows). */
  async function sendAndAwaitTurn(
    page: import('@playwright/test').Page,
    message: string,
    finishedTurns: number,
  ): Promise<void> {
    const input = page.getByPlaceholder(/Ask Tracey/);
    await input.fill(message);
    await page.getByRole('button', { name: 'Send' }).click();
    // The status bar renders only once a turn finishes, so its count tracks completed turns.
    await expect(page.getByTestId('tracey-message-status')).toHaveCount(finishedTurns, {
      timeout: 90_000,
    });
  }

  test('agent list and agent cards render from the core reads', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/tracey-ai', { waitUntil: 'load' });

    await sendAndAwaitTurn(page, 'List my agents.', 1);
    const list = page.getByTestId('tracey-agent-list');
    await expect(list).toBeVisible();
    await expect(list).toContainText(agentName);

    await sendAndAwaitTurn(page, `Show me the agent "${agentName}" in detail.`, 2);
    const card = page.getByTestId('tracey-agent-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText(agentName);
  });

  test('a loaded skill stays loaded for the whole conversation', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/tracey-ai', { waitUntil: 'load' });

    // Turn 1: suites are gated behind the test-suites-and-runs skill, so Tracey must call load_skill
    // before she can read them. load_skill renders as hidden thread noise (no visible tool card by
    // design), so the observable proof it fired is that the GATED suite-list card renders at all,
    // with our seeded suite.
    await sendAndAwaitTurn(page, 'List my test suites.', 1);
    const suiteList = page.getByTestId('tracey-suite-list');
    await expect(suiteList).toBeVisible();
    await expect(suiteList).toContainText(suiteName);

    // Turn 2: the skill persists for the rest of the conversation, so a second gated read (recent
    // runs) succeeds without re-loading the skill — the run-list card rendering on a later turn is
    // the observable proof the skill's tools were still available.
    await sendAndAwaitTurn(page, 'Now list the recent test runs.', 2);
    await expect(page.getByTestId('tracey-run-list')).toBeVisible();
  });
});
