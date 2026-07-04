import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// proposals.spec.ts covers SystemPrompt theories. The review desk's dossier reuses the same
// kind-specific sections (ModelSwitchSection / ToolUpdateSection), so we seed ModelSwitch and
// ToolUpdate theories (no optimizer pipeline, no LLM) and assert those sections render in the
// dossier pane.
test.describe('Review desk — ModelSwitch & ToolUpdate kinds', () => {
  let token: string;
  let agentId: string;
  let proposedEndpointId: string;
  const modelSwitchRationale = `E2E ModelSwitch theory ${Date.now()}`;
  const toolUpdateRationale = `E2E ToolUpdate theory ${Date.now()}`;
  let modelSwitchId: string;
  let toolUpdateId: string;

  test.beforeEach(async ({ request }) => {
    const api = new ProxytraceApiClient(request);
    ({ token } = await api.login('admin@e2e.test', 'E2ePassword1!'));
    api.setToken(token);

    const endpointId = await api.firstEndpointId();
    const agents = await api.listAgents();
    agentId = agents.items[0]?.id ?? (await api.createAgent({ name: `Theory Kinds Agent ${Date.now()}`, endpointId })).id;

    // ModelSwitch needs a proposed endpoint distinct from the agent's. Add a second model to the
    // first provider to get one.
    const overview = await api.getProvidersOverview();
    const providerId = overview.providers[0].provider.id;
    proposedEndpointId = (await api.addModelToProvider(providerId, `gpt-4o-mini-switch-${Date.now()}`)).id;

    modelSwitchId = (
      await api.seedTheory({
        agentId,
        status: 'Proposed',
        kind: 'ModelSwitch',
        rationale: modelSwitchRationale,
        proposedEndpointId,
      })
    ).id;

    toolUpdateId = (
      await api.seedTheory({
        agentId,
        status: 'Proposed',
        kind: 'ToolUpdate',
        rationale: toolUpdateRationale,
        proposedTools: [{ name: 'web_search', description: 'Search the web', parametersJson: null }],
      })
    ).id;
  });

  test('a ModelSwitch theory renders ModelSwitchSection in its dossier', async ({ page }) => {
    await page.goto('/proposals', { waitUntil: 'load' });
    await page.getByTestId(`theory-row-${modelSwitchId}`).click();
    await expect(page.getByTestId('inflight-dossier')).toBeVisible();
    await expect(page.getByTestId('model-switch-section')).toBeVisible();
  });

  test('a ToolUpdate theory renders ToolUpdateSection in its dossier', async ({ page }) => {
    await page.goto('/proposals', { waitUntil: 'load' });
    await page.getByTestId(`theory-row-${toolUpdateId}`).click();
    await expect(page.getByTestId('inflight-dossier')).toBeVisible();
    await expect(page.getByTestId('tool-update-section')).toBeVisible();
    await expect(page.getByTestId('tool-update-section')).toContainText('web_search');
  });
});
