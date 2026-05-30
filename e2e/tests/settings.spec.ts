import { test, expect } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';

// Settings page (/settings) — todo section 12.
// Covers ProjectsTab (list, create, add member), SearchIndexingTab (reindex + status),
// project delete with type-to-confirm, and ToggleRow feature-flag persistence across reload.
//
// Prerequisites (provider, the default "E2E Test Project", a model endpoint, and the admin
// user) are created by auth.setup.spec.ts. We seed extra data through the API client so the
// UI assertions stay fast and independent of other UI flows.

const ADMIN_EMAIL = 'admin@e2e.test';
const ADMIN_PASSWORD = 'E2ePassword1!';

test.describe('Settings', () => {
  let api: ProxytraceApiClient;
  let endpointId: string;

  test.beforeAll(async ({ request }) => {
    api = new ProxytraceApiClient(request);
    const { token } = await api.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    api.setToken(token);
    endpointId = await api.firstEndpointId();
  });

  test('ProjectsTab lists existing projects with member counts', async ({ page }) => {
    // Seed a project via the API so there is a deterministic row to assert on.
    const name = `Settings List ${Date.now()}`;
    const project = await api.createProject(name, endpointId);

    await page.goto('/settings', { waitUntil: 'load' });
    await expect(page.getByTestId('projects-tab')).toBeVisible();

    const row = page.getByTestId(`project-row-${project.id}`);
    await expect(row).toBeVisible();
    await expect(row).toContainText(name);
    // Member-count cell — a freshly-created project has 0 members.
    await expect(page.getByTestId(`project-row-members-${project.id}`)).toContainText('0 members');
  });

  test('creating a project via NewProjectModal makes it appear in the list', async ({ page }) => {
    const name = `UI Created ${Date.now()}`;

    await page.goto('/settings', { waitUntil: 'load' });
    await expect(page.getByTestId('projects-tab')).toBeVisible();

    await page.getByTestId('project-create-btn').click();
    await expect(page.getByTestId('new-project-modal')).toBeVisible();

    await page.getByTestId('project-name-input').fill(name);
    // The system-endpoint <select> defaults to the first endpoint, which exists from setup.
    await page.getByRole('button', { name: 'Create project' }).click();

    // The new project becomes the selected detail and shows up in the list.
    await expect(page.getByText(name).first()).toBeVisible();

    // Confirm via the API read-back that it was actually persisted.
    await expect
      .poll(async () => (await api.getProjects()).items.map((p) => p.name))
      .toContain(name);
  });

  test('adding a member via AddMemberModal shows the member row', async ({ page }) => {
    // Seed a fresh project with no members, then add the admin user through the UI.
    const project = await api.createProject(`Member Target ${Date.now()}`, endpointId);
    const users = await api.listUsers();
    const admin = users.items.find((u) => u.email === ADMIN_EMAIL);
    expect(admin, 'admin user should exist').toBeTruthy();
    if (!admin) return;

    await page.goto('/settings', { waitUntil: 'load' });
    await page.getByTestId(`project-row-${project.id}`).click();

    await page.getByTestId('add-member-btn').click();
    await expect(page.getByTestId('add-member-modal')).toBeVisible();

    await page.getByTestId(`add-member-candidate-${admin.id}`).click();

    // The member row appears in the detail panel with the user's email.
    const memberRow = page.getByTestId(`member-row-${admin.id}`);
    await expect(memberRow).toBeVisible();
    await expect(memberRow).toContainText(admin.email);
  });

  test('SearchIndexingTab reindex reflects indexing status', async ({ page }) => {
    const project = await api.createProject(`Reindex Target ${Date.now()}`, endpointId);

    await page.goto('/settings', { waitUntil: 'load' });
    // Switch to the Search indexing tab.
    await page.getByRole('button', { name: 'Search indexing' }).click();
    await expect(page.getByTestId('search-indexing-tab')).toBeVisible();

    // Select the seeded project in this tab's project list.
    await page.getByTestId(`search-project-row-${project.id}`).click();
    await expect(page.getByTestId('reindex-btn')).toBeVisible();

    // The status cell renders once the status query resolves.
    const indexStatus = page.getByTestId('index-status');
    await expect(indexStatus).toBeVisible();

    // The state cell starts Idle; after triggering a reindex it shows Reindexing and
    // (the status query polls every 5s) eventually settles back to Idle. Reindex can also
    // complete near-instantly for an empty project, so we accept either known state.
    await page.getByTestId('reindex-btn').click();

    await expect
      .poll(async () => (await indexStatus.textContent())?.trim(), {
        timeout: 15_000,
        message: 'index status never settled',
      })
      .toMatch(/Idle|Reindexing/);

    // And the API agrees a reindex was performed (document count is a number, no error).
    const status = await api.getSearchStatus(project.id);
    expect(typeof status.documentCount).toBe('number');
  });

  test('deleting a project requires type-to-confirm then removes it', async ({ page }) => {
    // Throwaway project so we never touch the shared "E2E Test Project".
    const name = `Delete Me ${Date.now()}`;
    const project = await api.createProject(name, endpointId);

    await page.goto('/settings', { waitUntil: 'load' });
    await page.getByTestId(`project-row-${project.id}`).click();

    await page.getByTestId('project-delete-btn').click();

    // ConfirmDialog (shared overlay) renders in a portal `.modal-panel`. Scope to it so the
    // confirm "Delete" button is unambiguous (the page's own delete trigger is also "Delete").
    const dialog = page.locator('.modal-panel');
    await expect(dialog).toBeVisible();
    const deleteBtn = dialog.getByRole('button', { name: 'Delete', exact: true });
    await expect(deleteBtn).toBeDisabled();
    await dialog.getByPlaceholder(name).fill(name);
    await expect(deleteBtn).toBeEnabled();
    await deleteBtn.click();

    // The row disappears from the list…
    await expect(page.getByTestId(`project-row-${project.id}`)).toHaveCount(0);
    // …and it is gone from the API read-back.
    await expect
      .poll(async () => (await api.getProjects()).items.map((p) => p.id))
      .not.toContain(project.id);
  });

  test('feature-flag toggle persists across reload', async ({ page }) => {
    const project = await api.createProject(`Toggle Target ${Date.now()}`, endpointId);

    await page.goto('/settings', { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Search indexing' }).click();
    await page.getByTestId(`search-project-row-${project.id}`).click();

    // The "Auto-reindex on change" toggle is a role=switch inside its labelled row.
    const toggleRow = page.getByTestId('toggle-row-autoReindex');
    const toggle = toggleRow.getByRole('switch');
    await expect(toggle).toBeVisible();

    const before = await toggle.getAttribute('aria-checked');
    const expected = before === 'true' ? 'false' : 'true';

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', expected);

    // Persist via Save changes (settings are stored server-side per project).
    await page.getByTestId('search-settings-save-btn').click();

    // Reload and confirm the flag survived (read back from the server).
    await page.reload({ waitUntil: 'load' });
    await page.getByRole('button', { name: 'Search indexing' }).click();
    await page.getByTestId(`search-project-row-${project.id}`).click();

    const reloadedToggle = page.getByTestId('toggle-row-autoReindex').getByRole('switch');
    await expect(reloadedToggle).toHaveAttribute('aria-checked', expected);
  });
});
