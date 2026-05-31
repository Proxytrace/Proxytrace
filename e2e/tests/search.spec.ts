import { test, expect } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';

// Search depth (/components/search palette + /settings → SearchIndexingTab).
//
// settings.spec.ts already covers the reindex-button + status-cell flow, so this spec
// covers everything beyond it: hit relevance (API + the global search palette UI), the
// recent feed, and search-settings persistence (API round-trip + the SearchIndexingTab
// toggle persisting across reload).
//
// The global search palette lives in the topbar (components/layout/Shell.tsx mounts
// <UnifiedSearch> whenever a project is selected) — it is NOT a modal you open. Focusing
// the input (Cmd/Ctrl+K via useGlobalShortcut, or a click) and typing >=2 chars opens the
// results dropdown. So the UI test focuses `search-input`, types the distinctive token,
// and asserts `search-results` / `search-result-${entityId}` render.
//
// Prerequisites (provider, default "E2E Test Project", a model endpoint, admin user) come
// from auth.setup.spec.ts. We seed searchable entities through the API client so the
// assertions stay fast and independent of other UI flows. We seed into the *first* project
// because that is the one the Shell selects by default and therefore the project the
// topbar palette searches.

const ADMIN_EMAIL = 'admin@e2e.test';
const ADMIN_PASSWORD = 'E2ePassword1!';

// Poll the index status until a reindex has finished and produced documents, so hit
// assertions don't race the asynchronous reindex.
async function waitForIndex(api: ProxytraceApiClient, projectId: string): Promise<void> {
  await api.reindexSearch(projectId);
  await expect
    .poll(async () => {
      const status = await api.getSearchStatus(projectId);
      return status.isReindexing === false && status.documentCount > 0;
    }, {
      timeout: 30_000,
      intervals: [500, 1_000, 2_000],
      message: 'index never finished reindexing with documents',
    })
    .toBe(true);
}

test.describe('Search', () => {
  let api: ProxytraceApiClient;
  let projectId: string;
  let endpointId: string;

  // A distinctive token unlikely to collide with any other seeded data, so the hit set is
  // deterministic. Reused across the agent + suite names that we assert on.
  const token = `Zzqx${Date.now()}`;
  const agentName = `${token} Agent`;
  const suiteName = `${token} Suite`;
  let agentId: string;
  let suiteId: string;

  test.beforeAll(async ({ request }) => {
    api = new ProxytraceApiClient(request);
    const { token: authToken } = await api.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    api.setToken(authToken);
    projectId = await api.firstProjectId();
    endpointId = await api.firstEndpointId();

    // Seed searchable entities into the default project: an agent with a distinctive name,
    // a suite (also distinctively named) wired to an Agentic evaluator with the token in its
    // name. createTestSuite needs an evaluator id, so create the evaluator first.
    const agent = await api.createAgent({ name: agentName, endpointId, projectId });
    agentId = agent.id;

    const evaluator = await api.createEvaluatorOfKind({
      kind: 'Agentic',
      projectId,
      name: `${token} Evaluator`,
      systemMessage: 'Judge whether the response is helpful.',
    });

    const suite = await api.createTestSuite(
      suiteName,
      agentId,
      [evaluator.id],
      [{ userContent: 'ping', expectedContent: 'pong' }],
    );
    suiteId = suite.id;

    // Populate the index before any hit assertions run.
    await waitForIndex(api, projectId);
  });

  test('API search returns a relevant hit for the distinctive token', async () => {
    const { hits } = await api.search(projectId, token);
    expect(hits.length, 'expected at least one hit for the seeded token').toBeGreaterThan(0);

    // The seeded agent should surface with a matching kind + title.
    const agentHit = hits.find((h) => h.entityId === agentId);
    expect(agentHit, 'seeded agent should be a search hit').toBeTruthy();
    expect(agentHit?.kind).toBe('agent');
    expect(agentHit?.title).toContain(token);

    // The seeded suite should surface too.
    const suiteHit = hits.find((h) => h.entityId === suiteId);
    expect(suiteHit, 'seeded suite should be a search hit').toBeTruthy();
    expect(suiteHit?.kind).toBe('testSuite');
  });

  test('the global search palette renders results for the query', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });

    // The palette is the topbar input; focusing it and typing >=2 chars opens the dropdown.
    const input = page.getByTestId('search-input');
    await expect(input).toBeVisible();
    await input.click();
    await input.fill(token);

    // The results pane appears and the seeded agent renders as a result row.
    await expect(page.getByTestId('search-results')).toBeVisible();
    await expect(page.getByTestId(`search-result-${agentId}`)).toBeVisible();
  });

  test('recent feed returns recently-indexed hits', async () => {
    const { hits } = await api.searchRecent(projectId, [], 6);
    expect(hits.length, 'recent feed should return seeded hits').toBeGreaterThan(0);
    expect(hits.length).toBeLessThanOrEqual(6);
    // Every hit carries the shape the palette renders.
    for (const hit of hits) {
      expect(typeof hit.kind).toBe('string');
      expect(typeof hit.entityId).toBe('string');
      expect(typeof hit.title).toBe('string');
    }
  });

  test('search settings persist via the API round-trip', async () => {
    const before = await api.getSearchSettings(projectId);
    const flipped = !before.autoReindexOnChange;

    await api.updateSearchSettings(projectId, {
      ...before,
      autoReindexOnChange: flipped,
    });

    const after = await api.getSearchSettings(projectId);
    expect(after.autoReindexOnChange).toBe(flipped);

    // Restore so this test leaves no lasting state on the shared default project.
    await api.updateSearchSettings(projectId, { ...before });
  });

  test('SearchIndexingTab toggle persists across reload', async ({ page }) => {
    // Use a throwaway project so we never mutate the shared default project's settings.
    const project = await api.createProject(`Search Settings ${Date.now()}`, endpointId);

    await page.goto('/settings', { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Search indexing' }).click();
    await expect(page.getByTestId('search-indexing-tab')).toBeVisible();
    await page.getByTestId(`search-project-row-${project.id}`).click();

    // The "Auto-reindex on change" row carries a role=switch (see ToggleRow).
    const toggle = page.getByTestId('toggle-row-autoReindex').getByRole('switch');
    await expect(toggle).toBeVisible();

    const before = await toggle.getAttribute('aria-checked');
    const expected = before === 'true' ? 'false' : 'true';

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', expected);

    // Persist server-side, then reload and confirm it survived.
    await page.getByTestId('search-settings-save-btn').click();

    await page.reload({ waitUntil: 'load' });
    await page.getByRole('button', { name: 'Search indexing' }).click();
    await page.getByTestId(`search-project-row-${project.id}`).click();

    const reloaded = page.getByTestId('toggle-row-autoReindex').getByRole('switch');
    await expect(reloaded).toHaveAttribute('aria-checked', expected);

    // And the server agrees (read-back via the API).
    await expect
      .poll(async () => (await api.getSearchSettings(project.id)).autoReindexOnChange)
      .toBe(expected === 'true');
  });
});
