import { test, expect } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';

test.describe('@llm test run', () => {
  test.skip(!process.env.OPENAI_API_KEY, 'requires OPENAI_API_KEY env var');

  test('run completes and result appears in Runs UI', async ({ page, request }) => {
    // The run makes a real LLM round-trip per case; allow well beyond the 60 s status poll.
    test.setTimeout(120_000);

    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);

    // Requires at least one agent (created by the ingestion spec, which this project depends on).
    const { items: agents } = await api.listAgents();
    expect(agents.length, 'need at least one agent — run ingestion spec first').toBeGreaterThan(0);
    const agent = agents[0];

    const { items: projects } = await api.getProjects();
    const projectId = projects[0].id;

    // Create an evaluator and a suite (tied to the agent) with one inline test case.
    const { id: evaluatorId } = await api.createEvaluator(projectId);
    const { id: suiteId } = await api.createTestSuite('E2E Suite', agent.id, [evaluatorId], [
      { userContent: 'Reply with exactly: pong', expectedContent: 'pong' },
    ]);

    // Start a run group against the agent's own model endpoint.
    const { id: groupId } = await api.createTestRunGroup(suiteId, [agent.endpointId]);

    // Poll until the group reaches a terminal state (max 60 s).
    await expect.poll(
      async () => {
        const group = await api.getTestRunGroup(groupId);
        return group.status;
      },
      { timeout: 60_000, intervals: [3_000], message: 'test run did not complete in time' },
    ).toMatch(/Completed|Failed/);

    // Run appears in the Runs UI.
    await page.goto('/runs', { waitUntil: 'load' });
    await expect(page.getByText('E2E Suite').first()).toBeVisible({ timeout: 10_000 });
  });
});
