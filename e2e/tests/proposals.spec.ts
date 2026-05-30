import { test, expect } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';

// Verifies the Proposals feature end to end. Proposals are seeded via the test-only
// POST /api/proposals/seed endpoint (the public ProposalsController exposes only GET +
// PATCH /status). Seeding requires no real LLM, so these tests are deterministic.
//
// IMPORTANT seeding constraints (see ProposalsController.Seed):
//   • Only SystemPrompt proposals can be seeded — the action returns 400 for any other kind.
//     There is therefore NO way to seed a ModelSwitch proposal, so the ModelSwitchSection
//     ("from → to model") test is intentionally omitted; see the note at the bottom.
//   • A seeded proposal always gets a freshly-created (Pending) A/B run attached. The card's
//     status pill reflects that A/B run state, not the literal ProposalStatus — a Draft seed
//     shows 'A/B queued', not 'Draft'. For approve/reject we therefore drive the
//     ProposalActionBar buttons and assert the new status via api.getProposals read-back.
//
// The proposals components expose stable data-testids: `proposal-list`, `proposal-card-<id>`,
// `proposal-status-<id>`, `proposal-detail`, `proposal-header`, `evidence-list`,
// `predicted-impact-band`, `prompt-diff`, `model-switch-section`, `proposal-action-bar`,
// `proposal-approve-btn`, `proposal-reject-btn`, `proposal-terminal-note`.
test.describe('Proposals', () => {
  // Playwright forbids reusing the beforeAll `request` fixture inside a test, so we persist only
  // the auth token + agent id here and rebuild a client per test against that test's own fixture.
  let token: string;
  let agentId: string;

  // A proposal seeded once for the read-back + render assertions (kept Draft / open).
  const sharedRationale = `E2E seeded proposal ${Date.now()}`;

  test.beforeAll(async ({ request }) => {
    const api = new ProxytraceApiClient(request);
    ({ token } = await api.login('admin@e2e.test', 'E2ePassword1!'));
    api.setToken(token);

    // A proposal targets an agent. Reuse an ingested agent if one exists; otherwise seed one
    // against the default endpoint so these (non-LLM) seeded-proposal tests run without a real
    // ingestion step.
    const agents = await api.listAgents();
    agentId =
      agents.items[0]?.id ??
      (await api.createAgent({ name: `E2E Proposal Agent ${Date.now()}`, endpointId: await api.firstEndpointId() })).id;

    await api.seedProposal({ agentId, rationale: sharedRationale, status: 'Draft' });
  });

  test('seeded proposal appears in the API read-back with its status', async ({ request }) => {
    const api = new ProxytraceApiClient(request, token);
    const proposals = await api.getProposals();
    const seeded = proposals.find((p) => p.rationale === sharedRationale);
    expect(seeded, 'seeded proposal should be returned by GET /api/proposals').toBeTruthy();
    expect(seeded?.status).toBe('Draft');
  });

  test('seeded proposal renders as a ProposalCard with its status', async ({ page }) => {
    await page.goto('/proposals', { waitUntil: 'load' });

    const list = page.getByTestId('proposal-list');
    await expect(list).toBeVisible();

    // The card title is derived from the first sentence of the rationale, which is the whole
    // rationale here (no '.'). Scope to the list so we don't also match the detail heading.
    const card = list.getByText(sharedRationale).first();
    await expect(card).toBeVisible();

    // A freshly-seeded Draft proposal's A/B run is Pending, so the status pill reads 'A/B queued'
    // (displayStatus in features/proposals/shared.ts), not the literal 'Draft'.
    await expect(list.getByText('A/B queued').first()).toBeVisible();
  });

  test('opening a proposal shows the detail, header, predicted-impact band and prompt diff', async ({ page, request }) => {
    const api = new ProxytraceApiClient(request, token);
    const rationale = `E2E detail proposal ${Date.now()}`;
    const { id } = await api.seedProposal({ agentId, rationale, status: 'Draft' });

    await page.goto('/proposals', { waitUntil: 'load' });

    // Select the specific seeded card by its stable per-id testid.
    const card = page.getByTestId(`proposal-card-${id}`);
    await expect(card).toBeVisible();
    await card.click();

    const detail = page.getByTestId('proposal-detail');
    await expect(detail).toBeVisible();
    await expect(detail.getByTestId('proposal-header')).toBeVisible();
    await expect(detail.getByTestId('predicted-impact-band')).toBeVisible();

    // SystemPrompt proposals render the prompt diff (old vs new system prompt).
    const diff = detail.getByTestId('prompt-diff');
    await expect(diff).toBeVisible();
    // seedProposal sends current 'You are a helpful assistant.' → proposed 'You are a concise,
    // helpful assistant.'. The diff renders both the removed and added lines.
    await expect(diff.getByText('You are a helpful assistant.')).toBeVisible();
    await expect(diff.getByText('You are a concise, helpful assistant.')).toBeVisible();
  });

  test('the action bar evidence list is absent without evidence runs', async ({ page, request }) => {
    // Seeded proposals carry an A/B run but no evidence run ids, so EvidenceList must not render.
    const api = new ProxytraceApiClient(request, token);
    const rationale = `E2E no-evidence proposal ${Date.now()}`;
    const { id } = await api.seedProposal({ agentId, rationale, status: 'Draft' });

    await page.goto('/proposals', { waitUntil: 'load' });
    await page.getByTestId(`proposal-card-${id}`).click();

    const detail = page.getByTestId('proposal-detail');
    await expect(detail).toBeVisible();
    await expect(detail.getByTestId('evidence-list')).toHaveCount(0);
  });

  test('approving via the action bar flips the status to Accepted', async ({ page, request }) => {
    const api = new ProxytraceApiClient(request, token);
    const rationale = `E2E approve proposal ${Date.now()}`;
    const { id } = await api.seedProposal({ agentId, rationale, status: 'Draft' });

    await page.goto('/proposals', { waitUntil: 'load' });
    await page.getByTestId(`proposal-card-${id}`).click();

    const bar = page.getByTestId('proposal-action-bar');
    await expect(bar).toBeVisible();
    await bar.getByTestId('proposal-approve-btn').click();

    // The pill / literal status diverge in the UI, so assert the canonical state via the API.
    await expect
      .poll(
        async () => {
          const proposals = await api.getProposals({ agentId });
          return proposals.find((p) => p.id === id)?.status;
        },
        { timeout: 10_000, intervals: [500], message: 'proposal status did not flip to Accepted' },
      )
      .toBe('Accepted');
  });

  test('rejecting via the action bar flips the status to Rejected and shows the terminal note', async ({ page, request }) => {
    const api = new ProxytraceApiClient(request, token);
    const rationale = `E2E reject proposal ${Date.now()}`;
    const { id } = await api.seedProposal({ agentId, rationale, status: 'Draft' });

    await page.goto('/proposals', { waitUntil: 'load' });
    await page.getByTestId(`proposal-card-${id}`).click();

    const bar = page.getByTestId('proposal-action-bar');
    await expect(bar).toBeVisible();
    await bar.getByTestId('proposal-reject-btn').click();

    await expect
      .poll(
        async () => {
          const proposals = await api.getProposals({ agentId });
          return proposals.find((p) => p.id === id)?.status;
        },
        { timeout: 10_000, intervals: [500], message: 'proposal status did not flip to Rejected' },
      )
      .toBe('Rejected');

    // Once terminal, the action bar is replaced by the terminal note. The card may need a moment
    // to re-render off the invalidated query; re-open it to land on the now-dismissed detail.
    const dismissedCard = page.getByTestId(`proposal-card-${id}`);
    await expect(dismissedCard).toBeVisible();
    await dismissedCard.click();
    const detail = page.getByTestId('proposal-detail');
    await expect(detail.getByTestId('proposal-terminal-note')).toBeVisible();
    await expect(detail.getByTestId('proposal-action-bar')).toHaveCount(0);
  });
});

// A real, LLM-generated proposal. Generation runs only against a *completed* test run group
// (POST /api/test-run-groups/{id}/optimize → background optimizer → ProposalBroadcaster), and
// the run executes the agent against a live model, so this is necessarily LLM-gated. There is
// no non-LLM trigger that produces a genuine (non-seeded) proposal.
test.describe('@llm proposal generation', () => {
  test.skip(!process.env.OPENAI_API_KEY, 'requires OPENAI_API_KEY env var');

  test('generating a proposal from run evidence surfaces it as a ProposalCard', async ({ page, request }) => {
    // Two real LLM round-trips (the run + the optimizer); allow generous time.
    test.setTimeout(180_000);

    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);

    const { items: agents } = await api.listAgents();
    expect(agents.length, 'need at least one agent — run ingestion spec first').toBeGreaterThan(0);
    const agent = agents[0];

    const { items: projects } = await api.getProjects();
    const projectId = projects[0].id;

    // A suite whose expectation the agent is likely to miss, giving the optimizer evidence to
    // propose a fix from.
    const { id: evaluatorId } = await api.createEvaluator(projectId);
    const { id: suiteId } = await api.createTestSuite('E2E Proposal Suite', agent.id, [evaluatorId], [
      { userContent: 'Reply with exactly: pong', expectedContent: 'definitely-not-the-answer' },
    ]);

    const { id: groupId } = await api.createTestRunGroup(suiteId, [agent.endpointId]);

    await expect
      .poll(
        async () => (await api.getTestRunGroup(groupId)).status,
        { timeout: 90_000, intervals: [3_000], message: 'test run did not complete in time' },
      )
      .toMatch(/Completed|Failed/);

    // Kick off optimization on the completed group (test-run-groups/{id}/optimize).
    const optimizeRes = await request.post(`/api/test-run-groups/${groupId}/optimize`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(optimizeRes.ok(), `optimize trigger failed: ${optimizeRes.status()}`).toBeTruthy();

    // Poll the API until the optimizer has produced at least one proposal for this agent.
    let proposalId: string | undefined;
    await expect
      .poll(
        async () => {
          const proposals = await api.getProposals({ agentId: agent.id });
          proposalId = proposals[0]?.id;
          return proposals.length;
        },
        { timeout: 90_000, intervals: [3_000], message: 'optimizer produced no proposal' },
      )
      .toBeGreaterThan(0);

    // It renders as a ProposalCard in the UI.
    await page.goto('/proposals', { waitUntil: 'load' });
    await expect(page.getByTestId('proposal-list')).toBeVisible();
    expect(proposalId, 'a generated proposal id should be available').toBeTruthy();
    await expect(page.getByTestId(`proposal-card-${proposalId}`)).toBeVisible({ timeout: 15_000 });
  });
});
