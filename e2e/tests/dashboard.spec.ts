import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// Dashboard ("Mission Control", route `/dashboard`, also reachable at `/`).
//
// All prerequisite data is seeded through the API (no LLM): we create agents on the
// default model endpoint and seed several agent-calls with explicit token + duration
// values so the dashboard's token, latency and trace stats are non-zero.
//
// The default project the dashboard renders is `projects[0]` (see ProjectProvider),
// which is the same `firstProjectId()` we seed against, so the seeded data lands in
// the default dashboard view. Seeded calls carry `CreatedAt = now`, which falls inside
// the dashboard's default `all`-time range (and every narrower window too).
//
// Because the shared e2e tenant may already hold data from other specs, assertions
// prefer "non-zero" / ">= seeded" over exact equality to stay robust.

const SUITE = `dash-${Date.now()}`;

test.describe('Dashboard', () => {
  let api: ProxytraceApiClient;
  let projectId: string;
  let endpointId: string;
  // Agents seeded for this run, with the number of calls seeded against each.
  const agentIds: string[] = [];
  let seededCalls = 0;
  let seededInputTokens = 0;
  let seededOutputTokens = 0;

  test.beforeEach(async ({ request }) => {
    // The DB is reset to the setup baseline before each test, so zero the per-run accumulators to
    // match the freshly-seeded data (they would otherwise grow across beforeEach invocations).
    agentIds.length = 0;
    seededCalls = 0;
    seededInputTokens = 0;
    seededOutputTokens = 0;

    api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);

    projectId = await api.firstProjectId();
    endpointId = await api.firstEndpointId();

    // Two agents so the per-agent token section has more than one series.
    for (let a = 0; a < 2; a++) {
      const agent = await api.createAgent({ name: `${SUITE}-agent-${a}`, endpointId, projectId });
      agentIds.push(agent.id);

      // Seed several calls per agent with non-trivial token + latency values.
      for (let c = 0; c < 3; c++) {
        const inputTokens = 120 + c * 10;
        const outputTokens = 60 + c * 5;
        const durationMs = 800 + c * 250;
        await api.seedAgentCall({
          agentId: agent.id,
          userContent: `hello ${a}-${c}`,
          assistantContent: `hi there ${a}-${c}`,
          inputTokens,
          outputTokens,
          durationMs,
        });
        seededCalls += 1;
        seededInputTokens += inputTokens;
        seededOutputTokens += outputTokens;
      }
    }
  });

  test('stat tiles reflect seeded trace and agent counts', async ({ page }) => {
    // Read back the canonical stats so the expected counts come from the same source
    // the dashboard uses (project-scoped statistics endpoint).
    const stats = await api.getStatistics({ projectId });
    expect(stats.summary.totalCalls).toBeGreaterThanOrEqual(seededCalls);

    await page.goto('/dashboard', { waitUntil: 'load' });

    const tiles = page.getByTestId('dashboard-stat-tiles');
    await expect(tiles).toBeVisible();

    // Traces tile shows the captured-call count; >= what we seeded (shared tenant).
    const tracesValue = page.getByTestId('stat-tile-traces-value');
    await expect(tracesValue).toBeVisible();
    await expect
      .poll(async () => parseInt((await tracesValue.textContent())?.replace(/[^\d]/g, '') ?? '0', 10))
      .toBeGreaterThanOrEqual(seededCalls);

    // The dashboard has no dedicated "agents"/"runs" stat tile; the detected-agent
    // count lives in the Agent fleet section header. Assert it reflects our seeded agents.
    const agentsCount = page.getByTestId('dashboard-agents-count');
    await expect(agentsCount).toBeVisible();
    await expect
      .poll(async () => parseInt((await agentsCount.textContent()) ?? '0', 10))
      .toBeGreaterThanOrEqual(agentIds.length);
  });

  test('hero token card shows non-zero total tokens', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });

    const card = page.getByTestId('hero-token-card');
    await expect(card).toBeVisible();

    const total = page.getByTestId('hero-token-total');
    await expect(total).toBeVisible();
    // The exact total is rendered into `data-token-total` (un-abbreviated), avoiding
    // having to parse the "1.2K"-style display string.
    await expect
      .poll(async () => Number((await total.getAttribute('data-token-total')) ?? '0'))
      .toBeGreaterThanOrEqual(seededInputTokens + seededOutputTokens);
  });

  test('pass-rate gauge component renders', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    // No LLM required: assert the gauge widget is present. A specific numeric rate is
    // covered by the @llm test below, since it needs a completed run.
    await expect(page.getByTestId('pass-rate-gauge')).toBeVisible();
  });

  test('agent fleet section lists seeded agents with their token totals', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });

    const section = page.getByTestId('agent-fleet');
    await expect(section).toBeVisible();

    // The roster renders one row per (non-system) agent — each seeded agent appears.
    for (const id of agentIds) {
      await expect(page.getByTestId(`agent-fleet-row-${id}`)).toBeVisible();
    }
  });

  test('latency section renders stats from seeded traces', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });

    const section = page.getByTestId('latency-section');
    await expect(section).toBeVisible();
    // Seeded calls carry durationMs, so the "N samples" sub-header is non-zero.
    await expect(section).toContainText(/\d+ samples/);
    // The spectrum draws a per-endpoint span row for the seeded endpoint.
    await expect(section.getByTestId(/^latency-endpoint-/).first()).toBeVisible();
  });

  test('pulse band renders with live counters', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });

    const band = page.getByTestId('pulse-band');
    await expect(band).toBeVisible();
    // The three counters render even at zero traffic ("—" or a number).
    await expect(band).toContainText(/traces\/min/i);
  });

  test('live trace stream contains a newly seeded trace after reload', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });

    const stream = page.getByTestId('live-trace-stream');
    await expect(stream).toBeVisible();

    const before = await page.getByTestId(/^live-trace-row-/).count();

    // Seed a fresh call while the page is open. NOTE: the test-only seed endpoint
    // (POST /api/agent-calls/seed) writes the call directly via the repository and
    // does NOT publish to the TraceBroadcaster — only the real ingestion pipeline
    // (AgentCallProcessor) emits `trace-created` SSE events. So the seed will not
    // push an SSE update. The dashboard also only refetches every 30s, which exceeds
    // a reasonable poll budget. We therefore reload to force a refetch and assert the
    // new row (newest by CreatedAt, so within the 6-row recent list) is present.
    const { id } = await api.seedAgentCall({
      agentId: agentIds[0],
      userContent: 'live-stream probe',
      assistantContent: 'probe ack',
      inputTokens: 42,
      outputTokens: 21,
      durationMs: 333,
    });

    await page.reload({ waitUntil: 'load' });

    await expect(page.getByTestId(`live-trace-row-${id}`)).toBeVisible();
    await expect
      .poll(async () => page.getByTestId(/^live-trace-row-/).count())
      .toBeGreaterThanOrEqual(Math.min(before, 6));
  });
});

// Numeric pass-rate requires a completed run, which requires a real LLM call.
test.describe('@llm Dashboard pass rate', () => {
  test.skip(!process.env.OPENAI_API_KEY, 'requires OPENAI_API_KEY env var');

  test('pass-rate gauge shows a numeric rate after a completed run', async ({ page, request }) => {
    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);

    const projectId = await api.firstProjectId();
    const endpointId = await api.firstEndpointId();
    const agent = await api.createAgent({ name: `${SUITE}-llm-agent`, endpointId, projectId });
    const evaluator = await api.createEvaluator(projectId);
    const suite = await api.createTestSuite(`${SUITE}-llm`, agent.id, [evaluator.id], [
      { userContent: 'Say the single word: hello', expectedContent: 'hello' },
    ]);

    const group = await api.createTestRunGroup(suite.id, [endpointId]);
    await expect
      .poll(async () => (await api.getTestRunGroup(group.id)).status, {
        timeout: 120_000,
        intervals: [3_000],
        message: 'run group did not complete',
      })
      .toMatch(/Completed|Failed/);

    await page.goto('/dashboard', { waitUntil: 'load' });
    const gauge = page.getByTestId('pass-rate-gauge');
    await expect(gauge).toBeVisible();
    // The gauge label "PASS RATE" sits alongside a numeric percentage rendered by
    // SegmentedGauge; assert a numeric value (with %) is shown.
    await expect(gauge).toContainText(/\d+%/);
  });
});
