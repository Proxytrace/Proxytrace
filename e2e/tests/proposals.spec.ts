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
  const rationale = `E2E seeded proposal ${Date.now()}`;
  // Playwright forbids reusing the beforeAll `request` fixture inside a test, so we persist only
  // the auth token here and rebuild a client per test against that test's own `request` fixture.
  let token: string;

  test.beforeAll(async ({ request }) => {
    const api = new ProxytraceApiClient(request);
    ({ token } = await api.login('admin@e2e.test', 'E2ePassword1!'));
    api.setToken(token);

    // A proposal targets an agent. Agents exist only after a call has been ingested, so this
    // spec depends on the ingestion project (see playwright.config.ts) for an agent to exist.
    const agents = await api.listAgents();
    const agentId = agents.items[0]?.id;
    expect(agentId, 'an agent must exist to seed a proposal').toBeTruthy();

    await api.seedProposal({ agentId, rationale, status: 'Draft' });
  });

  test('seeded proposal appears in the API read-back with its status', async ({ request }) => {
    const api = new ProxytraceApiClient(request, token);
    const proposals = await api.getProposals();
    const seeded = proposals.find((p) => p.rationale === rationale);
    expect(seeded, 'seeded proposal should be returned by GET /api/proposals').toBeTruthy();
    expect(seeded?.status).toBe('Draft');
  });

  test('seeded proposal renders on the Proposals page with its status', async ({ page }) => {
    await page.goto('/proposals', { waitUntil: 'load' });
    // The rationale appears both as a list-card title and the opened detail heading, so scope
    // to the first match rather than asserting a single element.
    await expect(page.getByText(rationale).first()).toBeVisible();
    // A Draft proposal's pill reflects its A/B run state, not the literal status. The seeded run
    // is freshly created (Pending), so the pill reads 'A/B queued' (see features/proposals/shared.ts).
    await expect(page.getByText('A/B queued').first()).toBeVisible();
  });
});
