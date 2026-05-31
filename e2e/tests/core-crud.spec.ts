import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// Setup (auth.setup.spec.ts) already completed initial setup with:
//   provider: 'E2E Test Provider', project: 'E2E Test Project', and a model that mirrors
//   LLM_MODEL when real creds are supplied (otherwise the gpt-4o-mini default).
// These tests verify that data and the UI reflects it.
const MODEL = process.env.LLM_MODEL ?? 'gpt-4o-mini';

test.describe('Core CRUD', () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    authToken = token;
  });

  test('provider appears in Providers UI', async ({ page }) => {
    await page.goto('/providers', { waitUntil: 'load' });
    await expect(page.getByText('E2E Test Provider').first()).toBeVisible();
  });

  test('model endpoint appears under provider', async ({ page }) => {
    await page.goto('/providers', { waitUntil: 'load' });
    await expect(page.getByText(MODEL).first()).toBeVisible();
  });

  test('project appears in API read-back', async ({ request }) => {
    const res = await request.get('/api/projects', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json() as { items: Array<{ name: string }> };
    const names = body.items.map((p) => p.name);
    expect(names).toContain('E2E Test Project');
  });
});
