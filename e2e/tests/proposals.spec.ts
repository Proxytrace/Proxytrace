import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// Verifies the Optimization Theories board (the /proposals route) end to end. The board is
// theory-driven: theories flow Proposed → Validating → Validated/Rejected, and a validated
// theory links to a reviewable proposal. Both are seeded via test-only endpoints
// (POST /api/theories/seed, POST /api/proposals/seed) so the states are deterministic and need
// no real LLM.
//
// Stable data-testids: `theory-board`, `theory-column-<status>`, `theory-column-count-<status>`,
// `theory-card-<id>`, `theory-handle-<id>`, `theory-promote-btn-<id>`, `decision-flow` (drawer,
// unproven theory), and — for a validated theory's drawer — `validated-proposal`, `gain-hero`,
// `prompt-diff`, `proposal-promote-btn` / `proposal-dismiss-btn` / `proposal-reset-btn`.
test.describe('Optimization Theories board', () => {
  let token: string;
  let agentId: string;

  test.beforeEach(async ({ request }) => {
    const api = new ProxytraceApiClient(request);
    ({ token } = await api.login('admin@e2e.test', 'E2ePassword1!'));
    api.setToken(token);

    const agents = await api.listAgents();
    agentId =
      agents.items[0]?.id ??
      (await api.createAgent({ name: `E2E Theory Agent ${Date.now()}`, endpointId: await api.firstEndpointId() })).id;
  });

  test('seeded theory appears in the API read-back with its status', async ({ request }) => {
    const api = new ProxytraceApiClient(request, token);
    const rationale = `E2E proposed theory ${Date.now()}`;
    const { id } = await api.seedTheory({ agentId, status: 'Proposed', rationale });

    const theories = await api.getTheories({ agentId });
    const seeded = theories.find((t) => t.id === id);
    expect(seeded, 'seeded theory should be returned by GET /api/theories').toBeTruthy();
    expect(seeded?.status).toBe('Proposed');
  });

  test('a proposed theory renders as a card in the Proposed column', async ({ page, request }) => {
    const api = new ProxytraceApiClient(request, token);
    const rationale = `E2E board proposed ${Date.now()}`;
    const { id } = await api.seedTheory({ agentId, status: 'Proposed', rationale });

    await page.goto('/proposals', { waitUntil: 'load' });

    await expect(page.getByTestId('theory-board')).toBeVisible();
    const card = page.getByTestId(`theory-card-${id}`);
    await expect(card).toBeVisible();
    // The card lives inside the Proposed column.
    await expect(page.getByTestId('theory-column-Proposed').getByTestId(`theory-card-${id}`)).toBeVisible();
    await expect(card.getByText(rationale)).toBeVisible();
  });

  test('opening a theory shows its decision flow', async ({ page, request }) => {
    const api = new ProxytraceApiClient(request, token);
    const rationale = `E2E theory flow ${Date.now()}`;
    const { id } = await api.seedTheory({ agentId, status: 'Proposed', rationale });

    await page.goto('/proposals', { waitUntil: 'load' });
    await page.getByTestId(`theory-card-${id}`).click();

    const flow = page.getByTestId('decision-flow');
    await expect(flow).toBeVisible();
    // The flow lays out the lifecycle stages top to bottom.
    await expect(flow.getByTestId('flow-step-evidence')).toBeVisible();
    await expect(flow.getByTestId('flow-step-outcome')).toBeVisible();
  });

  test('a validated theory leads with the proven gain and change diff in the drawer', async ({ page, request }) => {
    const api = new ProxytraceApiClient(request, token);
    // A validated theory references a reviewable proposal; seed the proposal first and link it.
    const currentMessage = `You are a helpful assistant. [${Date.now()}]`;
    const { id: detailAgentId } = await api.createAgent({
      name: `E2E Validated Agent ${Date.now()}`,
      endpointId: await api.firstEndpointId(),
      systemMessage: currentMessage,
    });
    const { id: proposalId } = await api.seedProposal({
      agentId: detailAgentId,
      rationale: `E2E backing proposal ${Date.now()}`,
      status: 'Draft',
    });
    const { id: theoryId } = await api.seedTheory({
      agentId: detailAgentId,
      status: 'Validated',
      rationale: `E2E validated theory ${Date.now()}`,
      baselinePassRate: 0.78,
      projectedPassRate: 0.9,
      pValue: 0.008,
      resultingProposalId: proposalId,
    });

    await page.goto('/proposals', { waitUntil: 'load' });

    const card = page.getByTestId(`theory-card-${theoryId}`);
    await expect(page.getByTestId('theory-column-Validated').getByTestId(`theory-card-${theoryId}`)).toBeVisible();
    await card.click();

    // A validated theory swaps the decision flow for the proposal-first view: the effective
    // gain leads, the concrete change is front and center, and Promote is immediately at hand.
    const view = page.getByTestId('validated-proposal');
    await expect(view).toBeVisible();
    await expect(view.getByTestId('gain-hero')).toContainText('+12pt');
    await expect(view.getByTestId('prompt-diff')).toBeVisible();
    await expect(view.getByTestId('proposal-promote-btn')).toBeVisible();
  });

  test('dismissing from the drawer flips the linked proposal to Rejected', async ({ page, request }) => {
    const api = new ProxytraceApiClient(request, token);
    const { id: proposalId } = await api.seedProposal({
      agentId,
      rationale: `E2E dismiss backing ${Date.now()}`,
      status: 'Draft',
    });
    const { id: theoryId } = await api.seedTheory({
      agentId,
      status: 'Validated',
      rationale: `E2E dismiss theory ${Date.now()}`,
      baselinePassRate: 0.8,
      projectedPassRate: 0.85,
      pValue: 0.04,
      resultingProposalId: proposalId,
    });

    await page.goto('/proposals', { waitUntil: 'load' });
    await page.getByTestId(`theory-card-${theoryId}`).click();
    await page.getByTestId('validated-proposal').getByTestId('proposal-dismiss-btn').click();

    await expect
      .poll(
        async () => {
          const proposals = await api.getProposals({ agentId });
          return proposals.find((p) => p.id === proposalId)?.status;
        },
        { timeout: 10_000, intervals: [500], message: 'proposal status did not flip to Rejected' },
      )
      .toBe('Rejected');
  });

  test('promoting a validated theory flips the linked proposal to Accepted', async ({ page, request }) => {
    const api = new ProxytraceApiClient(request, token);
    const { id: proposalId } = await api.seedProposal({
      agentId,
      rationale: `E2E promote backing ${Date.now()}`,
      status: 'Draft',
    });
    const { id: theoryId } = await api.seedTheory({
      agentId,
      status: 'Validated',
      rationale: `E2E promote theory ${Date.now()}`,
      baselinePassRate: 0.71,
      projectedPassRate: 0.78,
      pValue: 0.03,
      resultingProposalId: proposalId,
    });

    await page.goto('/proposals', { waitUntil: 'load' });

    const promote = page.getByTestId(`theory-promote-btn-${theoryId}`);
    await expect(promote).toBeVisible();
    await promote.click();

    await expect
      .poll(
        async () => {
          const proposals = await api.getProposals({ agentId });
          return proposals.find((p) => p.id === proposalId)?.status;
        },
        { timeout: 10_000, intervals: [500], message: 'proposal status did not flip to Accepted' },
      )
      .toBe('Accepted');
  });
});

// A real, LLM-generated proposal still surfaces on the board: its winning theory is Validated and
// links to the generated proposal. Generation runs only against a *completed* test run group and
// hits a live model, so this is LLM-gated.
test.describe('@llm optimizer pipeline', () => {
  test.skip(!process.env.OPENAI_API_KEY, 'requires OPENAI_API_KEY env var');

  // Exercises the real optimizer → theory → A/B validation → board pipeline end to end. We assert
  // the deterministic, meaningful outcome: from a failing run, the optimizer surfaces a theory that
  // *completes validation* (reaches a terminal Validated/Invalidated state) and renders on the
  // board. We deliberately do NOT assert that a proposal is produced — whether the A/B *wins*
  // depends on the model exactly-matching a string, which is inherently non-deterministic. (Earlier
  // this whole pipeline hung on an optimistic-concurrency conflict in the A/B run; this guards it.)
  test('optimizer surfaces a theory that completes validation on the board', async ({ page, request }) => {
    test.setTimeout(180_000);

    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);

    const projectId = await api.firstProjectId();
    const endpointId = await api.firstEndpointId();
    const agent = await api.createAgent({ name: `E2E Optimizer Agent ${Date.now()}`, endpointId });

    // A clearly-failing expectation guarantees the optimizer has something to hypothesise about,
    // so it reliably produces at least one theory to validate.
    const { id: evaluatorId } = await api.createEvaluator(projectId);
    const { id: suiteId } = await api.createTestSuite('E2E Optimizer Suite', agent.id, [evaluatorId], [
      { userContent: 'Reply with exactly: pong', expectedContent: 'definitely-not-the-answer' },
    ]);

    const { id: groupId } = await api.createTestRunGroup(suiteId, [agent.endpointId]);

    await expect
      .poll(
        async () => (await api.getTestRunGroup(groupId)).status,
        { timeout: 90_000, intervals: [3_000], message: 'test run did not complete in time' },
      )
      .toMatch(/Completed|Failed/);

    const optimizeRes = await request.post(`/api/test-run-groups/${groupId}/optimize`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(optimizeRes.ok(), `optimize trigger failed: ${optimizeRes.status()}`).toBeTruthy();

    // Poll until a theory for this agent reaches a terminal validation state. Reaching a terminal
    // state at all proves the A/B validation ran to completion (the concurrency bug would have
    // aborted it).
    let theoryId: string | undefined;
    await expect
      .poll(
        async () => {
          const theories = await api.getTheories({ agentId: agent.id });
          const terminal = theories.find((t) => t.status === 'Validated' || t.status === 'Invalidated');
          theoryId = terminal?.id;
          return terminal?.status;
        },
        { timeout: 120_000, intervals: [3_000], message: 'optimizer theory never completed validation' },
      )
      .toMatch(/Validated|Invalidated/);

    await page.goto('/proposals', { waitUntil: 'load' });
    await expect(page.getByTestId('theory-board')).toBeVisible();
    expect(theoryId, 'a validated/invalidated theory id should be available').toBeTruthy();
    await expect(page.getByTestId(`theory-card-${theoryId}`)).toBeVisible({ timeout: 15_000 });
  });
});
