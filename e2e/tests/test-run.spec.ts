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

  test('single-model run renders group card, run detail, heatmap and per-case scores', async ({ page, request }) => {
    test.setTimeout(120_000);

    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);

    const { items: agents } = await api.listAgents();
    expect(agents.length).toBeGreaterThan(0);
    const agent = agents[0];
    const projectId = await api.firstProjectId();

    const { id: evaluatorId } = await api.createEvaluator(projectId);
    const { id: suiteId } = await api.createTestSuite('E2E Detail Suite', agent.id, [evaluatorId], [
      { userContent: 'Reply with exactly: pong', expectedContent: 'pong' },
    ]);

    // Identify the test case so we can target its CaseTile by id.
    const suite = await api.getTestSuite(suiteId);
    const caseId = suite.testCases[0].id;

    const { id: groupId } = await api.createTestRunGroup(suiteId, [agent.endpointId]);
    await expect.poll(
      async () => (await api.getTestRunGroup(groupId)).status,
      { timeout: 60_000, intervals: [3_000], message: 'run did not complete' },
    ).toMatch(/Completed|Failed/);

    await page.goto('/runs', { waitUntil: 'load' });

    // GroupListCard exists for the group and is selectable.
    const card = page.getByTestId(`group-list-card-${groupId}`);
    await expect(card).toBeVisible({ timeout: 10_000 });
    await page.getByTestId(`group-list-card-btn-${groupId}`).click();

    // Status badge shows the terminal state.
    await expect(page.getByTestId(`group-status-${groupId}`)).toContainText(/Completed|Failed/);

    // Single-model group renders the RunDetail body with the case-results grid.
    await expect(page.getByTestId('run-detail')).toBeVisible();
    await expect(page.getByTestId('case-dot-legend')).toBeVisible();

    // The CaseTile for our case is rendered and carries a pass/fail state attribute.
    const tile = page.getByTestId(`case-tile-${caseId}`);
    await expect(tile).toBeVisible();
    await expect(tile).toHaveAttribute('data-case-state', /pass|fail/);

    // EvaluatorHeatmap renders with a cell for our evaluator × the run's endpoint.
    await expect(page.getByTestId('evaluator-heatmap')).toBeVisible();

    // Open the case fixture drawer → per-evaluator scores listed.
    await tile.click();
    await expect(page.getByTestId('fixture-evaluator-list')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId(`fixture-evaluator-${evaluatorId}`)).toBeVisible();
  });

  test('multi-model run ranks endpoints in matrix + leaderboard', async ({ page, request }) => {
    test.setTimeout(120_000);

    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);

    const { items: agents } = await api.listAgents();
    expect(agents.length).toBeGreaterThan(0);
    const agent = agents[0];
    const projectId = await api.firstProjectId();

    // Find the provider that owns the agent's endpoint and add a second model so we have
    // two distinct endpoints to compare in the leaderboard.
    const providers = await api.listProviders();
    const owning = providers.find(p => p.endpoints.some(e => e.id === agent.endpointId));
    expect(owning, 'agent endpoint must belong to a provider').toBeTruthy();
    const baseModel = process.env.LLM_MODEL ?? 'gpt-4o-mini';
    // A provider rejects a duplicate model name (409), so the second endpoint must use a
    // distinct name. The leaderboard + matrix render a column/entry per endpoint regardless
    // of whether each run passes, so this gives us two endpoints to compare even if the
    // second model name is not a live model.
    const added = await api.addModelToProvider(owning!.id, `${baseModel}-leaderboard`);

    const { id: evaluatorId } = await api.createEvaluator(projectId);
    const { id: suiteId } = await api.createTestSuite('E2E Multi Suite', agent.id, [evaluatorId], [
      { userContent: 'Reply with exactly: pong', expectedContent: 'pong' },
    ]);
    const suite = await api.getTestSuite(suiteId);
    const caseId = suite.testCases[0].id;

    const endpointIds = [agent.endpointId, added.id];
    const { id: groupId } = await api.createTestRunGroup(suiteId, endpointIds);
    await expect.poll(
      async () => (await api.getTestRunGroup(groupId)).status,
      { timeout: 90_000, intervals: [3_000], message: 'multi-model run did not complete' },
    ).toMatch(/Completed|Failed/);

    await page.goto('/runs', { waitUntil: 'load' });
    await page.getByTestId(`group-list-card-btn-${groupId}`).click();

    // ModelLeaderboard ranks both endpoints.
    await expect(page.getByTestId('model-leaderboard')).toBeVisible({ timeout: 10_000 });
    for (const id of endpointIds) {
      await expect(page.getByTestId(`model-leaderboard-entry-${id}`)).toBeVisible();
    }

    // MatrixView shows one column per endpoint and one row per test case.
    await expect(page.getByTestId('matrix-view')).toBeVisible();
    for (const id of endpointIds) {
      await expect(page.getByTestId(`matrix-col-${id}`)).toBeVisible();
    }
    await expect(page.getByTestId(`matrix-row-${caseId}`)).toBeVisible();
  });

  test('suites page Run button drives RunConfirmModal → run group appears under /runs', async ({ page, request }) => {
    test.setTimeout(120_000);

    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);

    const { items: agents } = await api.listAgents();
    expect(agents.length).toBeGreaterThan(0);
    const agent = agents[0];
    const projectId = await api.firstProjectId();

    const { id: evaluatorId } = await api.createEvaluator(projectId);
    const suiteName = 'E2E Run-From-Suites';
    const { id: suiteId } = await api.createTestSuite(suiteName, agent.id, [evaluatorId], [
      { userContent: 'Reply with exactly: pong', expectedContent: 'pong' },
    ]);

    // Drive the /suites page: open the suite's run modal, pick the agent's endpoint, confirm.
    // The suites feature exposes no run-specific testids, so we use the accessible
    // card testid + button text the RunConfirmModal renders.
    await page.goto('/suites', { waitUntil: 'load' });
    const suiteCard = page.getByTestId(`suite-card-${suiteId}`);
    await expect(suiteCard).toBeVisible({ timeout: 10_000 });
    await suiteCard.getByRole('button', { name: /Run (now|again)/ }).click();

    // RunConfirmModal: select the agent's model endpoint then start the run.
    const endpoint = (await api.listProviders())
      .flatMap(p => p.endpoints)
      .find(e => e.id === agent.endpointId);
    expect(endpoint).toBeTruthy();
    await page.getByRole('button', { name: new RegExp(endpoint!.modelName) }).first().click();
    await page.getByRole('button', { name: /Start run|Run on \d+ endpoints/ }).click();

    // The modal confirms the run started.
    await expect(page.getByText(/Evaluation started|Parallel evaluation started/)).toBeVisible({ timeout: 15_000 });

    // A run group for this suite eventually appears under /runs.
    await expect.poll(
      async () => {
        await page.goto('/runs', { waitUntil: 'load' });
        return page.getByText(suiteName).first().isVisible().catch(() => false);
      },
      { timeout: 30_000, intervals: [3_000], message: 'run group did not appear under /runs' },
    ).toBe(true);
  });
});
