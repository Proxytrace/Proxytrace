import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// Verifies the Optimization Proposals review desk (the /proposals route) end to end. The page is
// a master/detail decision inbox: theories flow Proposed → Validating → Validated/Invalidated in
// the queue rail (grouped by urgency — Needs decision / Awaiting adoption / In flight / History),
// and the selected theory opens as a dossier in the right pane. Both theories and proposals are
// seeded via test-only endpoints (POST /api/theories/seed, POST /api/proposals/seed) so the
// states are deterministic and need no real LLM.
//
// Stable data-testids: `review-desk`, `proposals-rail`, `queue-group-<key>`,
// `queue-group-count-<key>`, `theory-row-<id>`, `dossier`, `inflight-dossier` (unproven theory),
// and — for a validated theory's dossier — `validated-proposal`, `gain-hero`, `prompt-diff`,
// `proposal-promote-btn` / `proposal-dismiss-btn` / `proposal-reset-btn` / `theory-reject-btn`.
test.describe('Optimization Proposals review desk', () => {
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

  test('a proposed theory renders as a row in the In flight group', async ({ page, request }) => {
    const api = new ProxytraceApiClient(request, token);
    const rationale = `E2E queue proposed ${Date.now()}`;
    const { id } = await api.seedTheory({ agentId, status: 'Proposed', rationale });

    await page.goto('/proposals', { waitUntil: 'load' });

    await expect(page.getByTestId('review-desk')).toBeVisible();
    const row = page.getByTestId(`theory-row-${id}`);
    await expect(row).toBeVisible();
    // The row lives inside the In flight group.
    await expect(page.getByTestId('queue-group-inflight').getByTestId(`theory-row-${id}`)).toBeVisible();
    await expect(row.getByText(rationale)).toBeVisible();
  });

  test('opening an in-flight theory shows its dossier with the planned change', async ({ page, request }) => {
    const api = new ProxytraceApiClient(request, token);
    const rationale = `E2E theory dossier ${Date.now()}`;
    const { id } = await api.seedTheory({ agentId, status: 'Proposed', rationale });

    await page.goto('/proposals', { waitUntil: 'load' });
    await page.getByTestId(`theory-row-${id}`).click();

    const dossier = page.getByTestId('dossier');
    await expect(dossier).toBeVisible();
    await expect(dossier.getByTestId('inflight-dossier')).toBeVisible();
    await expect(dossier.getByText(rationale)).toBeVisible();
    // An unproven theory offers its dismissal, not a promote.
    await expect(dossier.getByTestId('theory-reject-btn')).toBeVisible();
  });

  test('a validated theory leads with the proven gain and change diff in the dossier', async ({ page, request }) => {
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

    const row = page.getByTestId(`theory-row-${theoryId}`);
    await expect(page.getByTestId('queue-group-decision').getByTestId(`theory-row-${theoryId}`)).toBeVisible();
    await row.click();

    // A validated theory's dossier leads with the effective gain, the concrete change is front
    // and center, and Promote is immediately at hand in the decision bar.
    const dossier = page.getByTestId('dossier');
    await expect(dossier.getByTestId('validated-proposal')).toBeVisible();
    await expect(dossier.getByTestId('gain-hero')).toContainText('+12pt');
    await expect(dossier.getByTestId('prompt-diff')).toBeVisible();
    await expect(dossier.getByTestId('proposal-promote-btn')).toBeVisible();
  });

  test('dismissing from the dossier flips the linked proposal to Rejected', async ({ page, request }) => {
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
    await page.getByTestId(`theory-row-${theoryId}`).click();
    await page.getByTestId('dossier').getByTestId('proposal-dismiss-btn').click();

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
    await page.getByTestId(`theory-row-${theoryId}`).click();

    const promote = page.getByTestId('proposal-promote-btn');
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

// A real, LLM-generated proposal still surfaces on the review desk: its winning theory is
// Validated and links to the generated proposal. Generation runs only against a *completed* test
// run group and hits a live model, so this is LLM-gated.
test.describe('@llm optimizer pipeline', () => {
  test.skip(!process.env.OPENAI_API_KEY, 'requires OPENAI_API_KEY env var');

  // Exercises the real optimizer → theory → A/B validation → review-desk pipeline end to end. We
  // assert the deterministic, meaningful outcome: from a failing run, the optimizer surfaces a
  // theory that *completes validation* (reaches a terminal Validated/Invalidated state) and
  // renders in the queue. We deliberately do NOT assert that a proposal is produced — whether the
  // A/B *wins* depends on the model exactly-matching a string, which is inherently
  // non-deterministic. (Earlier this whole pipeline hung on an optimistic-concurrency conflict in
  // the A/B run; this guards it.)
  test('optimizer surfaces a theory that completes validation on the review desk', async ({ page, request }) => {
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
    let terminalStatus: string | undefined;
    await expect
      .poll(
        async () => {
          const theories = await api.getTheories({ agentId: agent.id });
          const terminal = theories.find((t) => t.status === 'Validated' || t.status === 'Invalidated');
          theoryId = terminal?.id;
          terminalStatus = terminal?.status;
          return terminal?.status;
        },
        { timeout: 120_000, intervals: [3_000], message: 'optimizer theory never completed validation' },
      )
      .toMatch(/Validated|Invalidated/);

    await page.goto('/proposals', { waitUntil: 'load' });
    await expect(page.getByTestId('review-desk')).toBeVisible();
    expect(theoryId, 'a validated/invalidated theory id should be available').toBeTruthy();
    // An invalidated theory lands in the collapsed History group — expand it before asserting.
    if (terminalStatus === 'Invalidated') {
      await page.getByTestId('queue-history-toggle').click();
    }
    await expect(page.getByTestId(`theory-row-${theoryId}`)).toBeVisible({ timeout: 15_000 });
  });
});
