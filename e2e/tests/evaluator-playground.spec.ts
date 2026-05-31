import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// ── Rule-based test bench (NO model required) ───────────────────────────────
// ExactMatch is deterministic: it compares the expected output against the actual
// response. By supplying an `actualResponseOverride` we drive a pass or fail without
// any LLM, so this describe is intentionally NOT gated on OPENAI_API_KEY.
test.describe('evaluator test bench — rule-based ExactMatch', () => {
  test('ExactMatch yields deterministic pass and fail', async ({ request }) => {
    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);

    const projectId = await api.firstProjectId();

    // We need an agent to tie the suite to. Prefer an existing one; otherwise seed one
    // against the default endpoint (no LLM call — seed endpoint builds it directly).
    const { items: agents } = await api.listAgents();
    const agentId = agents[0]?.id
      ?? (await api.createAgent({ name: 'Bench Agent', endpointId: await api.firstEndpointId(), projectId })).id;

    // ExactMatch evaluator + a suite with one inline test case.
    const { id: evaluatorId } = await api.createEvaluatorOfKind({ kind: 'ExactMatch', projectId });
    const { id: suiteId } = await api.createTestSuite('Bench Suite', agentId, [evaluatorId], [
      { userContent: 'Say pong', expectedContent: 'pong' },
    ]);
    const suite = await api.getTestSuite(suiteId);
    const testCaseId = suite.testCases[0].id;

    // Matching actual response → pass (Acceptable, no error).
    const pass = await api.runEvaluatorTestBench(evaluatorId, testCaseId, 'pong');
    expect(pass.score).toBe('Acceptable');

    // Mismatching actual response → fail (Terrible).
    const fail = await api.runEvaluatorTestBench(evaluatorId, testCaseId, 'WRONG');
    expect(fail.score).toBe('Terrible');
  });
});

// ── Agentic (LLM) test bench ────────────────────────────────────────────────
test.describe('@llm evaluator test bench — agentic', () => {
  test.skip(!process.env.OPENAI_API_KEY, 'requires OPENAI_API_KEY env var');

  test('pick a test result + agentic evaluator, run the bench → verdict shown', async ({ page, request }) => {
    test.setTimeout(120_000);

    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);

    const projectId = await api.firstProjectId();
    const { items: agents } = await api.listAgents();
    expect(agents.length, 'need at least one agent — run ingestion spec first').toBeGreaterThan(0);
    const agent = agents[0];

    // Agentic evaluator (LLM-judged); runs against the project's system endpoint.
    const { id: evaluatorId } = await api.createEvaluatorOfKind({
      kind: 'Agentic',
      projectId,
      name: 'E2E Helpfulness Judge',
      systemMessage: 'You judge whether the assistant reply is helpful. Reply with a score.',
    });

    // The bench loads the latest test result for the evaluator, so the evaluator must have
    // produced at least one result. Build a suite with it and run it once to completion.
    const { id: suiteId } = await api.createTestSuite('E2E Agentic Suite', agent.id, [evaluatorId], [
      { userContent: 'Reply with exactly: pong', expectedContent: 'pong' },
    ]);
    const { id: groupId } = await api.createTestRunGroup(suiteId, [agent.endpointId]);
    await expect.poll(
      async () => (await api.getTestRunGroup(groupId)).status,
      { timeout: 90_000, intervals: [3_000], message: 'seed run did not complete' },
    ).toMatch(/Completed|Failed/);

    // Open the evaluator playground directly on the agentic evaluator (URL ?id= param).
    await page.goto(`/evaluator-playground?id=${evaluatorId}`, { waitUntil: 'load' });
    await expect(page.getByTestId('evaluator-playground')).toBeVisible({ timeout: 10_000 });

    // The select reflects the chosen evaluator and the TestResultPicker is available.
    await expect(page.getByTestId('evaluator-playground-select')).toHaveValue(evaluatorId, { timeout: 15_000 });
    await expect(page.getByTestId('test-result-picker')).toBeVisible();

    // The default test result auto-loads → the expected/actual panes render.
    await expect(page.getByTestId('test-bench-panes')).toBeVisible({ timeout: 15_000 });

    // Run the bench → a scored verdict appears in the result area.
    await page.getByTestId('test-bench-run').click();
    const result = page.getByTestId('test-bench-result');
    await expect(result).toContainText(
      /Terrible|Bad|Acceptable|Good|Excellent/,
      { timeout: 90_000 },
    );
  });
});
