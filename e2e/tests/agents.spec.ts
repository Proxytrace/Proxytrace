import { test, expect } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';

// The Agents page lists agents that exist for the tenant and renders an empty state when there
// are none. Agents are normally discovered from ingested traffic, but the public API also
// supports explicit creation against a model endpoint, so we can seed one without an LLM call.
//
// Ordering matters: the empty-state assertion must observe a tenant with no agents, so it runs
// before this spec (or any earlier core spec) creates one. The setup project seeds only a
// provider/model/project/api-key — never an agent — so a fresh DB starts with zero agents.
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
});
