import { test, expect } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';

const PROXY_URL = 'http://localhost:5102';
const UPSTREAM_ENDPOINT = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
const LLM_MODEL = process.env.LLM_MODEL ?? 'gpt-4o-mini';
// Use OpenAiCompatible when pointing at a non-OpenAI endpoint.
const PROVIDER_KIND = UPSTREAM_ENDPOINT.includes('api.openai.com') ? 'OpenAi' : 'OpenAiCompatible';

test.describe('@llm chat completion trace lands on Traces page', () => {
  // Gate the whole describe so CI (and any key-less local run) skips it cleanly.
  test.skip(!process.env.OPENAI_API_KEY, 'requires OPENAI_API_KEY env var');

  let proxyApiKey: string;
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    authToken = token;
    api.setToken(token);

    // auth.setup.spec.ts already created a default project. Stand up a dedicated real
    // LLM provider and mint a Proxytrace proxy key scoped to that project.
    const projects = await api.getProjects();
    const projectId = projects.items[0].id;

    const provider = await api.createProvider({
      name: 'E2E Proxy-Trace Provider',
      endpoint: UPSTREAM_ENDPOINT,
      upstreamApiKey: process.env.OPENAI_API_KEY!,
      kind: PROVIDER_KIND,
    });

    const key = await api.createProviderApiKey(provider.id, 'e2e-proxy-trace-key', projectId);
    proxyApiKey = key.keyValue;
  });

  test('proxied chat completion shows up as a trace and opens in the detail drawer', async ({
    page,
    request,
  }) => {
    // The proxy makes a real LLM round-trip, then we poll up to 30 s for ingestion, so the
    // overall test timeout must comfortably exceed the poll window.
    test.setTimeout(90_000);

    const api = new ProxytraceApiClient(request);
    api.setToken(authToken);
    const before = await api.getAgentCalls({ pageSize: 1 });
    const countBefore: number = before.total ?? 0;

    // Send a real chat completion through the OpenAI-compatible proxy.
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
        // Newer models reject the deprecated `max_tokens`; `max_completion_tokens` is
        // accepted across current OpenAI/Azure chat-completion models.
        max_completion_tokens: 50,
      },
    });
    expect(
      proxyRes.ok(),
      `proxy returned ${proxyRes.status()}: ${await proxyRes.text()}`,
    ).toBeTruthy();

    // Ingestion is eventually consistent (proxy -> Redis -> API). Poll the captured call
    // back out of the API and grab its id so we can target its row in the UI.
    let newCallId = '';
    await expect
      .poll(
        async () => {
          const after = await api.getAgentCalls({ pageSize: 1 });
          if ((after.total ?? 0) <= countBefore) return false;
          newCallId = String(after.items[0]?.id ?? '');
          return newCallId.length > 0;
        },
        { timeout: 30_000, intervals: [2_000], message: 'proxied call was not ingested' },
      )
      .toBe(true);

    // The trace must be visible on the Traces page.
    await page.goto('/traces', { waitUntil: 'load' });
    await expect(page.getByTestId('trace-list')).toBeVisible();
    const row = page.getByTestId(`trace-row-${newCallId}`);
    await expect(row).toBeVisible({ timeout: 10_000 });

    // Opening the row reveals the trace detail with a captured agent identity, confirming
    // the proxied call was parsed and persisted end to end.
    await row.click();
    await expect(page.getByTestId('trace-detail-drawer')).toBeVisible();
    await expect(page.getByTestId('trace-detail-agent-name')).not.toBeEmpty();
  });
});
