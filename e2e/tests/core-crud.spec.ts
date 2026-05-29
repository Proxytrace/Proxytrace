import { test, expect } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';

test.describe('Core CRUD', () => {
  let apiKeyValue: string;
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    authToken = token;
    api.setToken(token);

    const result = await api.completeSetup({
      providerName: 'E2E Test Provider',
      providerEndpoint: 'https://api.openai.com/v1',
      providerUpstreamApiKey: 'sk-e2e-placeholder',
      providerKind: 'OpenAi',
      modelName: 'gpt-4o-mini',
      projectName: 'E2E Test Project',
      apiKeyName: 'e2e-key',
    });

    apiKeyValue = result.apiKeyValue;
  });

  test('provider appears in Providers UI', async ({ page }) => {
    await page.goto('/providers', { waitUntil: 'load' });
    await expect(page.getByText('E2E Test Provider')).toBeVisible();
  });

  test('model endpoint appears under provider', async ({ page }) => {
    await page.goto('/providers', { waitUntil: 'load' });
    await expect(page.getByText('gpt-4o-mini')).toBeVisible();
  });

  test('project appears in API read-back', async ({ request }) => {
    const api = new ProxytraceApiClient(request);
    api.setToken(authToken);
    const res = await request.get('/api/projects', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json() as { items: Array<{ name: string }> };
    const names = body.items.map((p) => p.name);
    expect(names).toContain('E2E Test Project');
  });

  test('api key was issued', () => {
    expect(apiKeyValue).toBeTruthy();
    expect(apiKeyValue.length).toBeGreaterThan(8);
  });
});
