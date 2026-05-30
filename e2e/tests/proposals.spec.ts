import { test, expect } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';

// Verifies that a proposal seeded via the API renders on the Proposals page together with
// its status. Seeding uses the test-only POST /api/proposals/seed endpoint (a backend stub
// the user implements); the public ProposalsController only exposes GET + PATCH /status.
//
// NOTE: the Proposals feature currently has NO data-testid hooks. This spec falls back to
// getByText for the rationale and status. If the page gains stable testids
// (e.g. `proposal-list`, `proposal-row-<id>`, `proposal-status-<id>`), tighten the selectors.
test.describe('Proposals', () => {
  let api: ProxytraceApiClient;
  const rationale = `E2E seeded proposal ${Date.now()}`;

  test.beforeAll(async ({ request }) => {
    api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);

    // A proposal targets an agent. Agents exist only after a call has been ingested, so this
    // spec depends on the ingestion project (see playwright.config.ts) for an agent to exist.
    const agents = await api.listAgents();
    const agentId = agents.items[0]?.id;
    expect(agentId, 'an agent must exist to seed a proposal').toBeTruthy();

    await api.seedProposal({ agentId, rationale, status: 'Draft' });
  });

  test('seeded proposal appears in the API read-back with its status', async () => {
    const proposals = await api.getProposals();
    const seeded = proposals.find((p) => p.rationale === rationale);
    expect(seeded, 'seeded proposal should be returned by GET /api/proposals').toBeTruthy();
    expect(seeded?.status).toBe('Draft');
  });

  test('seeded proposal renders on the Proposals page with its status', async ({ page }) => {
    await page.goto('/proposals', { waitUntil: 'load' });
    await expect(page.getByText(rationale)).toBeVisible();
    // The status pill renders the proposal status text ('Draft').
    await expect(page.getByText('Draft').first()).toBeVisible();
  });
});
