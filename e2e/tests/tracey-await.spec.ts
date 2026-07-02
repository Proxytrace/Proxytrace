import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// Drives the Tracey AI chat through the full await_actions flow: ask Tracey to run a suite, watch
// her live run-progress card stream to a terminal state, and confirm she only finishes the turn
// once the run is done (i.e. she waited via await_actions and analysed in the same turn) rather
// than firing the run and stopping. Real LLM + a real test run, so it is @llm-gated and given a
// generous timeout. The assistant's tool choice is non-deterministic; the prompt is deliberately
// explicit. Write actions are always auto-approved, so start_test_run needs no confirmation click.
test.describe('@llm Tracey await_actions', () => {
  test.skip(!process.env.OPENAI_API_KEY, 'requires OPENAI_API_KEY env var');

  let api: ProxytraceApiClient;
  let suiteName: string;
  let agentName: string;

  test.beforeEach(async ({ request }) => {
    api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);

    const endpointId = await api.firstEndpointId();
    const projectId = await api.firstProjectId();

    // Seed this test's own agent + suite (the DB reset does not apply to @llm projects, but we
    // still self-seed so the spec depends on no other spec's data and the names are unique).
    const stamp = Date.now();
    agentName = `E2E Tracey Agent ${stamp}`;
    suiteName = `E2E Tracey Suite ${stamp}`;
    const agent = await api.createAgent({ name: agentName, endpointId, projectId });
    const { id: evaluatorId } = await api.createEvaluator(projectId);
    await api.createTestSuite(suiteName, agent.id, [evaluatorId], [
      { userContent: 'Reply with exactly: pong', expectedContent: 'pong' },
    ]);
  });

  test('Tracey runs a suite, streams the progress card, and reports the result in-turn', async ({ page }) => {
    // Tracey reasons over several tool steps and then awaits a real test run; allow well beyond
    // the run-completion poll window.
    test.setTimeout(180_000);

    await page.goto('/tracey-ai', { waitUntil: 'load' });

    // Ask her to run the seeded suite and wait for the result. Referencing the suite + agent by
    // their unique names keeps her tool calls unambiguous.
    const input = page.getByPlaceholder(/Ask Tracey/);
    await input.fill(
      `Run the test suite "${suiteName}" against the agent "${agentName}". ` +
        `Wait for the run to finish, then tell me how many test cases passed.`,
    );
    await page.getByRole('button', { name: 'Send' }).click();

    // #2 — the live run-progress card renders once she calls start_test_run. The model may retry
    // a transiently failed call, leaving more than one card in the thread — scope to the latest
    // so an earlier card can't trip strict mode (#273).
    const card = page.getByTestId('tracey-run-progress-card').last();
    await expect(card).toBeVisible({ timeout: 90_000 });

    // #2 — the card streams to a terminal state. The running footer reads "Running… N/M cases";
    // a terminal one reads "X/Y passed", "Run failed.", or "Run cancelled." — so matching
    // passed|failed|cancelled only fires once the run is done.
    await expect(page.getByTestId('tracey-run-progress-status').last()).toContainText(
      /passed|failed|cancelled/i,
      { timeout: 150_000 },
    );

    // #1 — she awaited the run and reported in the SAME turn: the turn's status bar (emitted only
    // when an assistant turn finishes) appears, and her analysis text references the outcome. Had
    // she fired the run and stopped, the turn would have ended long before the card went terminal.
    await expect(page.getByTestId('tracey-message-status').last()).toBeVisible({ timeout: 30_000 });
    await expect(card).toContainText(/passed|failed|cancelled/i);
    await expect(page.getByText(/pass/i).last()).toBeVisible();
  });
});
