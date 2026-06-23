import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

const PROXY_URL = 'http://localhost:5102';
const UPSTREAM_ENDPOINT = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
const LLM_MODEL = process.env.LLM_MODEL ?? 'gpt-4o-mini';
// Use OpenAiCompatible when pointing at a non-OpenAI endpoint.
const PROVIDER_KIND = UPSTREAM_ENDPOINT.includes('api.openai.com') ? 'OpenAi' : 'OpenAiCompatible';

test.describe('@llm ingestion via proxy', () => {
  test.skip(!process.env.OPENAI_API_KEY, 'requires OPENAI_API_KEY env var');

  let proxyApiKey: string;
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    authToken = token;
    api.setToken(token);

    // Setup already created a default project in auth.setup.spec.ts. Create a dedicated real LLM
    // provider and issue a proxy API key for it. Use firstProjectId() (oldest = the project the UI
    // defaults to): the projects list is newest-first, so items[0] can be a leftover project from
    // an earlier spec — ingesting the call (and its agent) where the UI and other specs can't see it.
    const projectId = await api.firstProjectId();

    // Providers are archive-only and survive the per-test DB reset, so on a retry this beforeAll
    // would collide with the previous attempt's provider on the unique name. Stamp it unique.
    const stamp = Date.now();
    const provider = await api.createProvider({
      name: `E2E LLM Provider ${stamp}`,
      endpoint: UPSTREAM_ENDPOINT,
      upstreamApiKey: process.env.OPENAI_API_KEY!,
      kind: PROVIDER_KIND,
    });

    const key = await api.createProviderApiKey(provider.id, `e2e-llm-key-${stamp}`, projectId);
    proxyApiKey = key.keyValue;
  });

  test('trace appears in UI after proxy request', async ({ page, request }) => {
    // The proxy call makes a real LLM round-trip and then we poll up to 30 s for the
    // trace to be ingested, so the test timeout must comfortably exceed the poll window.
    test.setTimeout(90_000);

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
        model: LLM_MODEL,
        // A system message is required: the ingestion parser keys agent identity on the
        // system prompt and silently drops any captured call that lacks one.
        messages: [
          { role: 'system', content: 'You are a terse test assistant.' },
          { role: 'user', content: 'Reply with exactly: pong' },
        ],
        // Newer models (gpt-5.x) reject the deprecated `max_tokens`; `max_completion_tokens`
        // is accepted by all current OpenAI/Azure chat-completion models.
        max_completion_tokens: 50,
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
    await expect(page.getByText(LLM_MODEL)).toBeVisible({ timeout: 10_000 });
  });
});
