import { test, expect } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';

// The Agents page lists agents that exist for the tenant and renders an empty state when there
// are none. Agents are normally discovered from ingested traffic, but the public API also
// supports explicit creation against a model endpoint, so we can seed one without an LLM call.
//
// Ordering matters: the empty-state assertion must observe a tenant with no agents, so it runs
// before this spec (or any earlier core spec) creates one. The setup project seeds only a
// provider/model/project/api-key — never an agent — so a fresh DB starts with zero agents.
//
// Reality of the agents feature surface (verified against the components + AgentsController):
//   • There is no UI "create agent" affordance and no public POST /api/agents — agents appear
//     via proxy ingestion. The test-only POST /api/agents/seed lets no-LLM specs create one.
//   • System prompt, version history (AgentVersion rows), and tool specs are all produced by the
//     ingestion pipeline. There is NO UI control or API to edit a system prompt in place, to
//     record a new version by editing, to roll a version back in place, or to add a tool spec.
//     The only version action ("Move…") moves a version to a DIFFERENT agent — not a rollback.
//   • The only mutating affordances reachable without an LLM call are the endpoint selector
//     (PATCH /api/agents/{id}/endpoint) and delete.
// The todo items that depend on the missing edit/version/rollback/add-tool mechanisms are
// therefore not implementable; the remaining ones (create, detail render, delete → empty state)
// are covered below. See the REPORT in the PR description for the per-item rationale.
test.describe('Agents page', () => {
  let api: ProxytraceApiClient;
  let endpointId: string;

  test.beforeAll(async ({ request }) => {
    api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);

    // The endpoint created during setup is what a new agent attaches to.
    const providers = await api.listProviders();
    const endpoint = providers.flatMap((p) => p.endpoints)[0];
    expect(endpoint, 'setup should have created at least one model endpoint').toBeTruthy();
    endpointId = endpoint.id;
  });

  test('shows an empty state when there are no agents', async ({ page }) => {
    const before = await api.listAgents();
    expect(before.items, 'this test must run before any agent is created').toHaveLength(0);

    await page.goto('/agents', { waitUntil: 'load' });

    await expect(page.getByTestId('agent-empty-state')).toBeVisible();
    await expect(page.getByText('No agents yet')).toBeVisible();
    await expect(page.getByTestId('agent-list')).toHaveCount(0);
  });

  test('lists agents that exist', async ({ page }) => {
    const agentName = `E2E Listed Agent ${Date.now()}`;
    const created = await api.createAgent({ name: agentName, endpointId });

    await page.goto('/agents', { waitUntil: 'load' });

    await expect(page.getByTestId('agent-list')).toBeVisible();
    await expect(page.getByTestId(`agent-card-${created.id}`)).toBeVisible();
    await expect(page.getByText(agentName)).toBeVisible();
    await expect(page.getByTestId('agent-empty-state')).toHaveCount(0);
  });

  // Create (via the test-only seed endpoint, since there is no UI create flow) → the new agent
  // renders in AgentList. Distinct from "lists agents that exist": this asserts a just-created
  // agent shows up by selecting its card and that its name renders in the detail header.
  test('a newly created agent appears in the list and can be opened', async ({ page }) => {
    const agentName = `E2E Created Agent ${Date.now()}`;
    const created = await api.createAgent({ name: agentName, endpointId });

    await page.goto('/agents', { waitUntil: 'load' });

    const card = page.getByTestId(`agent-card-${created.id}`);
    await expect(card).toBeVisible();
    await card.click();

    await expect(page.getByTestId('agent-header')).toBeVisible();
    await expect(page.getByTestId('agent-name')).toHaveText(agentName);
  });

  // AgentDetail renders the agent's name, system prompt, and selected endpoint. We deep-link with
  // ?id= so the agent is preselected on load, and assert the three core fields the detail surfaces.
  test('opening an agent renders name, system prompt and endpoint', async ({ page }) => {
    const agentName = `E2E Detail Agent ${Date.now()}`;
    const systemMessage = `You are a meticulous detail-test assistant ${Date.now()}.`;
    const created = await api.createAgent({ name: agentName, endpointId, systemMessage });

    await page.goto(`/agents?id=${created.id}`, { waitUntil: 'load' });

    await expect(page.getByTestId('agent-header')).toBeVisible();
    await expect(page.getByTestId('agent-name')).toHaveText(agentName);
    await expect(page.getByTestId('agent-system-prompt')).toContainText(systemMessage);

    // The endpoint selector shows the endpoint the agent is attached to.
    const endpoint = await api.getAgent(created.id);
    const providers = await api.listProviders();
    const modelName = providers.flatMap((p) => p.endpoints).find((e) => e.id === endpoint.endpointId)?.modelName;
    expect(modelName, 'the agent endpoint should resolve to a model name').toBeTruthy();
    await expect(page.getByTestId('agent-endpoint')).toContainText(modelName!);
  });

  // Delete an agent through the UI: the header delete button opens a confirm dialog that requires
  // typing the agent name, then removes the card from the list. We isolate this agent in its own
  // (freshly created) name so other parallel specs can't make the assertion flaky.
  test('deleting an agent removes it from the list', async ({ page }) => {
    const agentName = `E2E Deletable Agent ${Date.now()}`;
    const created = await api.createAgent({ name: agentName, endpointId });

    await page.goto(`/agents?id=${created.id}`, { waitUntil: 'load' });

    await expect(page.getByTestId(`agent-card-${created.id}`)).toBeVisible();
    await page.getByTestId('agent-delete-btn').click();

    // ConfirmDialog gates the destructive action behind typing the exact entity name.
    await page.getByPlaceholder(agentName).fill(agentName);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(page.getByTestId(`agent-card-${created.id}`)).toHaveCount(0);
    await expect.poll(async () => {
      const { items } = await api.listAgents();
      return items.some((a) => a.id === created.id);
    }, { message: 'agent should be deleted server-side' }).toBe(false);
  });

  // When the last agent is deleted the page returns to its empty state. This must run LAST in the
  // file because it requires the tenant to reach zero agents — and it cleans up every agent the
  // earlier tests created. (Playwright runs tests in file order within a describe.)
  test('removing the last agent restores the empty state', async ({ page }) => {
    // Delete every remaining agent via the API so we reliably reach zero, regardless of how many
    // earlier specs created. (Seeded agents are non-system; the list never contains system agents
    // unless ingestion created one, which this no-LLM suite never does.)
    const { items } = await api.listAgents();
    for (const a of items) {
      await api.deleteAgent(a.id);
    }

    await expect.poll(async () => (await api.listAgents()).items.length, {
      message: 'all agents should be deleted before asserting the empty state',
    }).toBe(0);

    await page.goto('/agents', { waitUntil: 'load' });

    await expect(page.getByTestId('agent-empty-state')).toBeVisible();
    await expect(page.getByText('No agents yet')).toBeVisible();
    await expect(page.getByTestId('agent-list')).toHaveCount(0);
  });
});
