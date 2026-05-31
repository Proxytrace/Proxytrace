import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// proposals.spec.ts covers SystemPrompt proposals. The seed endpoint now also accepts ModelSwitch
// and ToolUpdate, so we can render their detail sections (ModelSwitchSection / ToolUpdateSection)
// without the optimizer pipeline (no LLM).
test.describe('Proposals — ModelSwitch & ToolUpdate kinds', () => {
  let token: string;
  let agentId: string;
  let proposedEndpointId: string;
  const modelSwitchRationale = `E2E ModelSwitch proposal ${Date.now()}`;
  const toolUpdateRationale = `E2E ToolUpdate proposal ${Date.now()}`;
  let modelSwitchId: string;
  let toolUpdateId: string;

  test.beforeEach(async ({ request }) => {
    const api = new ProxytraceApiClient(request);
    ({ token } = await api.login('admin@e2e.test', 'E2ePassword1!'));
    api.setToken(token);

    const endpointId = await api.firstEndpointId();
    const agents = await api.listAgents();
    agentId = agents.items[0]?.id ?? (await api.createAgent({ name: `Proposal Kinds Agent ${Date.now()}`, endpointId })).id;

    // ModelSwitch needs a proposed endpoint distinct from the agent's. Add a second model to the
    // first provider to get one.
    const overview = await api.getProvidersOverview();
    const providerId = overview.providers[0].provider.id;
    proposedEndpointId = (await api.addModelToProvider(providerId, `gpt-4o-mini-switch-${Date.now()}`)).id;

    modelSwitchId = (
      await api.seedProposal({
        agentId,
        kind: 'ModelSwitch',
        rationale: modelSwitchRationale,
        proposedEndpointId,
      })
    ).id;

    toolUpdateId = (
      await api.seedProposal({
        agentId,
        kind: 'ToolUpdate',
        rationale: toolUpdateRationale,
        proposedTools: [{ name: 'web_search', description: 'Search the web', parametersJson: null }],
      })
    ).id;
  });

  test('a seeded ModelSwitch proposal renders ModelSwitchSection in its detail', async ({ page }) => {
    await page.goto('/proposals', { waitUntil: 'load' });
    await page.getByTestId(`proposal-card-${modelSwitchId}`).click();
    await expect(page.getByTestId('proposal-detail')).toBeVisible();
    await expect(page.getByTestId('model-switch-section')).toBeVisible();
  });

  test('a seeded ToolUpdate proposal renders ToolUpdateSection in its detail', async ({ page }) => {
    await page.goto('/proposals', { waitUntil: 'load' });
    await page.getByTestId(`proposal-card-${toolUpdateId}`).click();
    await expect(page.getByTestId('proposal-detail')).toBeVisible();
    await expect(page.getByTestId('tool-update-section')).toBeVisible();
    await expect(page.getByTestId('tool-update-section')).toContainText('web_search');
  });
});
