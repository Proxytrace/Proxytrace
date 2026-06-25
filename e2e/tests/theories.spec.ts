import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// Verifies the optimization-theory submission pipeline end to end. Submission is synchronous
// and needs no real LLM (the background A/B validation runs afterwards and is not asserted on),
// so these tests are deterministic in the core project. A theory targets an agent and names the
// suite to validate against; both are seeded over the API.
test.describe('Optimization Theories', () => {
  let api: ProxytraceApiClient;
  let agentId: string;
  let suiteId: string;

  test.beforeEach(async ({ request }) => {
    api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);

    const endpointId = await api.firstEndpointId();
    const projectId = await api.firstProjectId();

    // Unique system message per agent to avoid the per-project agent-version fingerprint collision.
    const agent = await api.createAgent({ name: `E2E Theory Agent ${Date.now()}`, endpointId });
    agentId = agent.id;

    const evaluator = await api.createEvaluator(projectId);
    const suite = await api.createTestSuite(
      `E2E Theory Suite ${Date.now()}`,
      agentId,
      [evaluator.id],
      [{ userContent: 'hi', expectedContent: 'hello' }],
    );
    suiteId = suite.id;
  });

  test('submitted theory is accepted and returned by the API', async () => {
    const theory = await api.submitTheory({
      agentId,
      suiteId,
      proposedSystemMessage: `You are a precise assistant. ${Date.now()}`,
      rationale: 'sharper instructions',
    });

    expect(theory.kind).toBe('SystemPrompt');
    expect(theory.source).toBe('External');
    expect(theory.agentId).toBe(agentId);
    expect(theory.suiteId).toBe(suiteId);
    expect(theory.resultingProposalId).toBeNull();

    const list = await api.getTheories({ agentId });
    expect(list.map((t) => t.id)).toContain(theory.id);

    const fetched = await api.getTheory(theory.id);
    expect(fetched.id).toBe(theory.id);
    expect(fetched.agentId).toBe(agentId);
  });

  test('an identical theory is rejected as a duplicate', async () => {
    const proposedSystemMessage = `You are a concise assistant. ${Date.now()}`;
    const first = await api.submitTheory({ agentId, suiteId, proposedSystemMessage, rationale: 'first' });
    expect(first.id).toBeTruthy();

    // Back-to-back: the first theory is still Proposed/Validating, so the identical resubmission
    // is deduplicated (same agent + same proposed change => same content hash).
    const dup = await api.theorySubmitResponse({ agentId, suiteId, proposedSystemMessage, rationale: 'duplicate' });
    expect(dup.status()).toBe(409);
  });

  test('submitting against a missing agent returns 404', async () => {
    const res = await api.theorySubmitResponse({
      agentId: '00000000-0000-0000-0000-000000000000',
      suiteId,
      proposedSystemMessage: 'anything',
      rationale: 'r',
    });
    expect(res.status()).toBe(404);
  });

  test('a Proposed theory can be rejected (skipping A/B) via the API', async () => {
    // Seeded theories bypass the validation queue, so the theory stays Proposed deterministically.
    const theory = await api.seedTheory({ agentId, status: 'Proposed', rationale: 'to reject' });
    expect(theory.status).toBe('Proposed');

    const rejected = await api.rejectTheory(theory.id);
    expect(rejected.status).toBe('Invalidated');

    // Already terminal → rejecting again is a 409.
    const again = await api.theoryRejectResponse(theory.id);
    expect(again.status()).toBe(409);
  });

  test('rejecting a Validating theory cancels it to Invalidated', async () => {
    const theory = await api.seedTheory({ agentId, status: 'Validating', rationale: 'cancel me' });
    expect(theory.status).toBe('Validating');

    const rejected = await api.rejectTheory(theory.id);
    expect(rejected.status).toBe('Invalidated');
  });

  test('rejecting a Proposed theory from the board removes its reject action', async ({ page }) => {
    const theory = await api.seedTheory({
      agentId,
      status: 'Proposed',
      rationale: `dismiss from board ${Date.now()}`,
    });

    await page.goto('/proposals', { waitUntil: 'load' });
    await expect(page.getByTestId(`theory-card-${theory.id}`)).toBeVisible({ timeout: 10_000 });

    await page.getByTestId(`theory-reject-btn-${theory.id}`).click();

    // Once rejected the theory is Invalidated, so its Proposed-only reject action disappears while
    // the card itself stays on the board (now in the Rejected column).
    await expect(page.getByTestId(`theory-reject-btn-${theory.id}`)).toBeHidden({ timeout: 10_000 });
    await expect(page.getByTestId(`theory-card-${theory.id}`)).toBeVisible();
    expect((await api.getTheory(theory.id)).status).toBe('Invalidated');
  });

  test('submitted theory appears as a card on the theories board', async ({ page }) => {
    const theory = await api.submitTheory({
      agentId,
      suiteId,
      proposedSystemMessage: `You greet the user warmly. ${Date.now()}`,
      rationale: 'friendlier tone',
    });

    await page.goto('/proposals', { waitUntil: 'load' });
    await expect(page.getByTestId('theory-board')).toBeVisible();
    // The card carries a column-independent testid; background A/B validation may move it between
    // columns, but it remains on the board.
    await expect(page.getByTestId(`theory-card-${theory.id}`)).toBeVisible({ timeout: 10_000 });
  });
});
