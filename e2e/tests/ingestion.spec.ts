import { test, expect } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';

const PROXY_URL = 'http://localhost:5102';

test.describe('@llm ingestion via proxy', () => {
  test.skip(!process.env.OPENAI_API_KEY, 'requires OPENAI_API_KEY env var');

  let proxyApiKey: string;
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    authToken = token;
    api.setToken(token);

    const result = await api.completeSetup({
      providerName: 'E2E LLM Provider',
      providerEndpoint: 'https://api.openai.com/v1',
      providerUpstreamApiKey: process.env.OPENAI_API_KEY!,
      providerKind: 'OpenAi',
      modelName: 'gpt-4o-mini',
      projectName: 'E2E LLM Project',
      apiKeyName: 'e2e-llm-key',
    });
    proxyApiKey = result.apiKeyValue;
  });

  test('trace appears in UI after proxy request', async ({ page, request }) => {
    const api = new ProxytraceApiClient(request);
    api.setToken(authToken);
    const before = await api.getAgentCalls({ pageSize: 1 });
    const countBefore: number = before.total ?? 0;

    // Send real chat completion through the proxy.
    const proxyRes = await request.post(`${PROXY_URL}/openai/v1/chat/completions`, {
      headers: {
        Authorization: `Bearer ${proxyApiKey}`,
        'Content-Type': 'application/json',
      },
      data: {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Reply with exactly: pong' }],
        max_tokens: 10,
      },
    });
    expect(proxyRes.ok(), `proxy returned ${proxyRes.status()}: ${await proxyRes.text()}`).toBeTruthy();

    // Poll until new agent call appears (max 30 s).
    await expect.poll(
      async () => {
        const after = await api.getAgentCalls({ pageSize: 1 });
        return (after.total ?? 0) > countBefore;
      },
      { timeout: 30_000, intervals: [2_000] },
    ).toBe(true);

    // Verify trace visible in Traces UI.
    await page.goto('/traces', { waitUntil: 'load' });
    await expect(page.getByText('gpt-4o-mini')).toBeVisible({ timeout: 10_000 });
  });
});
