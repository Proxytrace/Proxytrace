import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// The agent-call seed endpoint publishes TraceCreatedEvent to ITraceBroadcaster (the same path
// real ingestion uses), so the dashboard's LiveTraceStream — wired to the SSE trace stream —
// appends a row live, without a page reload. This exercises the SSE broadcaster end to end.
test.describe('SSE real-time trace stream', () => {
  let agentId: string;

  test.beforeEach(async ({ request }) => {
    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);
    const endpointId = await api.firstEndpointId();
    agentId = (await api.createAgent({ name: `SSE Agent ${Date.now()}`, endpointId })).id;
  });

  test('a newly ingested trace streams into LiveTraceStream without a reload', async ({ page, request }) => {
    const client = new ProxytraceApiClient(request);
    const { token } = await client.login('admin@e2e.test', 'E2ePassword1!');
    client.setToken(token);

    await page.goto('/dashboard', { waitUntil: 'load' });
    await expect(page.getByTestId('live-trace-stream')).toBeVisible();

    // Seed a trace AFTER the SSE subscription is live; the row must arrive via the push, so we
    // never navigate or reload between the seed and the assertion.
    const seeded = await client.seedAgentCall({
      agentId,
      userContent: 'sse ping',
      assistantContent: 'sse pong',
    });

    await expect
      .poll(async () => page.getByTestId(`live-trace-row-${seeded.id}`).count(), {
        timeout: 20_000,
        intervals: [1_000],
        message: 'seeded trace did not stream into LiveTraceStream via SSE',
      })
      .toBeGreaterThan(0);
  });
});
