import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// Mirror the backend OutlierFlags bitmask (Proxytrace.Domain.AgentCall.OutlierFlags).
const HIGH_LATENCY = 2;

test.describe('Outlier detection', () => {
  let api: ProxytraceApiClient;
  let endpointId: string;

  test.beforeEach(async ({ request }) => {
    api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);
    endpointId = await api.firstEndpointId();
  });

  test('Outliers-only toggle filters the Traces list and the flagged row shows a marker', async ({ page }) => {
    const agent = await api.createAgent({ name: `Outlier Agent ${Date.now()}`, endpointId });
    const outlier = await api.seedAgentCall({
      agentId: agent.id,
      userContent: 'flag me',
      assistantContent: 'ok',
      outlierFlags: HIGH_LATENCY,
    });
    const normal = await api.seedAgentCall({
      agentId: agent.id,
      userContent: 'a normal call',
      assistantContent: 'ok',
    });

    await page.goto('/traces', { waitUntil: 'load' });

    // Both rows are present before filtering, and the flagged one carries the outlier marker.
    await expect(page.getByTestId(`trace-row-${outlier.id}`)).toBeVisible();
    await expect(page.getByTestId(`trace-row-${normal.id}`)).toBeVisible();
    await expect(page.getByTestId(`trace-outlier-marker-${HIGH_LATENCY}`)).toBeVisible();

    // Turning on "Outliers only" hides the normal call and keeps the outlier.
    await page.getByTestId('traces-outlier-toggle').click();
    await expect(page.getByTestId(`trace-row-${outlier.id}`)).toBeVisible();
    await expect(page.getByTestId(`trace-row-${normal.id}`)).toHaveCount(0);
  });

  test('Recent outliers widget on the agent page lists the flagged call', async ({ page }) => {
    const agent = await api.createAgent({ name: `Outlier Agent ${Date.now()}`, endpointId });
    const outlier = await api.seedAgentCall({
      agentId: agent.id,
      userContent: 'flag me',
      assistantContent: 'ok',
      outlierFlags: HIGH_LATENCY,
    });

    await page.goto(`/agents?id=${agent.id}`, { waitUntil: 'load' });

    await expect(page.getByTestId('agent-recent-outliers-list')).toBeVisible();
    await expect(page.getByTestId(`agent-recent-outlier-${outlier.id}`)).toBeVisible();
  });

  test('admin can change outlier sensitivity and it persists', async ({ page }) => {
    await page.goto('/settings/outlier-detection', { waitUntil: 'load' });

    await page.getByTestId('outlier-sigma').fill('4.5');

    // Wait for the PUT to land before reloading, so the reload doesn't race (or abort) the save.
    const saved = page.waitForResponse(
      (r) => r.url().includes('/api/outlier-settings') && r.request().method() === 'PUT' && r.ok(),
    );
    await page.getByTestId('outlier-save-btn').click();
    await saved;

    // The form reloads its values from the API, so a reload proves the change was persisted.
    await page.reload({ waitUntil: 'load' });
    await expect(page.getByTestId('outlier-sigma')).toHaveValue('4.5');
  });
});
