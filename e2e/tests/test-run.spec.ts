import { test, expect } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';

test.describe('@llm test run', () => {
  test.skip(!process.env.OPENAI_API_KEY, 'requires OPENAI_API_KEY env var');

  test('run completes and result appears in Runs UI', async ({ page, request }) => {
    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);

    // Requires at least one agent (created by the ingestion spec).
    const { items: agents } = await api.listAgents();
    expect(agents.length, 'need at least one agent — run ingestion spec first').toBeGreaterThan(0);
    const agentId = agents[0].id;

    // Create evaluator, suite, case.
    const { id: evaluatorId } = await api.createEvaluator('E2E ExactMatch');
    const { id: suiteId } = await api.createTestSuite('E2E Suite', [evaluatorId]);
    await api.createTestCase(suiteId, 'Reply with exactly: pong', 'pong');

    // Start run.
    const { id: runId } = await api.startTestRun(suiteId, agentId);

    // Poll until run reaches Completed or Failed (max 60 s).
    await expect.poll(
      async () => {
        const run = await api.getTestRun(runId);
        return run.status;
      },
      { timeout: 60_000, intervals: [3_000], message: 'test run did not complete in time' },
    ).toMatch(/Completed|Failed/);

    // Run appears in the Runs UI.
    await page.goto('/runs', { waitUntil: 'networkidle' });
    await expect(page.getByText('E2E Suite')).toBeVisible({ timeout: 10_000 });
  });
});
