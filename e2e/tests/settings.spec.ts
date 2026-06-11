import { test, expect } from '../helpers/fixtures';
import type { Page } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';

// Settings hub (/settings) — admin-only. A left sub-nav splits PROJECT sections (General,
// Members, Search indexing — all act on the *active* project, the one the sidebar switcher
// selects) from WORKSPACE sections (Projects, Providers, Users, Error log, Danger zone). This
// spec covers the project-scoped sections plus workspace project management (list/create/delete/
// switch). Providers/Users/Error log have their own specs.
//
// Setup (auth.setup.spec.ts) seeds the admin user, a provider/model/endpoint, and the default
// "E2E Test Project". The per-test reset keeps that baseline; we seed extra projects via the API.

const ADMIN_EMAIL = 'admin@e2e.test';
const ADMIN_PASSWORD = 'E2ePassword1!';

test.describe('Settings', () => {
  let api: ProxytraceApiClient;
  let endpointId: string;

  test.beforeEach(async ({ request }) => {
    api = new ProxytraceApiClient(request);
    const { token } = await api.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    api.setToken(token);
    endpointId = await api.firstEndpointId();
  });

  // The project-scoped sections act on the active project. A freshly-seeded project isn't active
  // (the provider defaults to the oldest), so switch to it via the Projects section first.
  async function activateProject(page: Page, id: string) {
    await page.goto('/settings/projects', { waitUntil: 'load' });
    await page.getByTestId(`project-switch-btn-${id}`).click();
    await expect(page.getByTestId(`project-active-${id}`)).toBeVisible();
  }

  test('Projects section lists projects with member counts', async ({ page }) => {
    const name = `Settings List ${Date.now()}`;
    const project = await api.createProject(name, endpointId);

    await page.goto('/settings/projects', { waitUntil: 'load' });
    await expect(page.getByTestId('settings-projects')).toBeVisible();

    const row = page.getByTestId(`project-row-${project.id}`);
    await expect(row).toBeVisible();
    await expect(row).toContainText(name);
    // A freshly-created project has 0 members.
    await expect(row).toContainText('0 members');
  });

  test('creating a project via NewProjectModal makes it appear in the list', async ({ page }) => {
    const name = `UI Created ${Date.now()}`;

    await page.goto('/settings/projects', { waitUntil: 'load' });
    await expect(page.getByTestId('settings-projects')).toBeVisible();

    await page.getByTestId('project-create-btn').click();
    await expect(page.getByTestId('new-project-modal')).toBeVisible();

    await page.getByTestId('project-name-input').fill(name);
    // The system-endpoint <select> defaults to the first endpoint, which exists from setup.
    await page.getByRole('button', { name: 'Create project' }).click();

    await expect(page.getByText(name).first()).toBeVisible();
    // Confirm via the API read-back that it was actually persisted.
    await expect
      .poll(async () => (await api.getProjects()).items.map((p) => p.name))
      .toContain(name);
  });

  test('adding a member to the active project shows the member row', async ({ page }) => {
    const project = await api.createProject(`Member Target ${Date.now()}`, endpointId);
    const users = await api.listUsers();
    const admin = users.items.find((u) => u.email === ADMIN_EMAIL);
    expect(admin, 'admin user should exist').toBeTruthy();
    if (!admin) return;

    await activateProject(page, project.id);
    await page.getByTestId('settings-nav-members').click();
    await expect(page.getByTestId('settings-members')).toBeVisible();

    await page.getByTestId('add-member-btn').click();
    await expect(page.getByTestId('add-member-modal')).toBeVisible();
    await page.getByTestId(`add-member-candidate-${admin.id}`).click();

    const memberRow = page.getByTestId(`member-row-${admin.id}`);
    await expect(memberRow).toBeVisible();
    await expect(memberRow).toContainText(admin.email);
  });

  test('SearchIndexing reindex reflects indexing status for the active project', async ({ page }) => {
    const project = await api.createProject(`Reindex Target ${Date.now()}`, endpointId);

    await activateProject(page, project.id);
    await page.getByTestId('settings-nav-search').click();
    await expect(page.getByTestId('settings-search')).toBeVisible();
    await expect(page.getByTestId('reindex-btn')).toBeVisible();

    const indexStatus = page.getByTestId('index-status');
    await expect(indexStatus).toBeVisible();

    // The state cell starts Idle; a reindex flips it to Reindexing and (status polls every 5s)
    // settles back to Idle. An empty project can complete near-instantly, so accept either.
    await page.getByTestId('reindex-btn').click();
    await expect
      .poll(async () => (await indexStatus.textContent())?.trim(), {
        timeout: 15_000,
        message: 'index status never settled',
      })
      .toMatch(/Idle|Reindexing/);

    const status = await api.getSearchStatus(project.id);
    expect(typeof status.documentCount).toBe('number');
  });

  test('deleting a project via the per-row confirm removes it', async ({ page }) => {
    // Throwaway project so we never touch the shared "E2E Test Project". A freshly-created project
    // carries only its built-in Tracey system agent, which the delete path removes automatically.
    const name = `Delete Me ${Date.now()}`;
    const project = await api.createProject(name, endpointId);

    await page.goto('/settings/projects', { waitUntil: 'load' });
    await page.getByTestId(`project-delete-btn-${project.id}`).click();

    // ConfirmDialog renders in a portal `.modal-panel`; scope to it so the confirm "Delete"
    // button is unambiguous. It names the project and gates the action behind a type-to-confirm.
    const dialog = page.locator('.modal-panel');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(name);
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

  test('search auto-reindex toggle reflects the persisted server value', async ({ page }) => {
    // The write path (toggle → save → persist) is covered by search.spec's API round-trip. Here we
    // verify the section binds the toggle to the persisted value: flip it via the API, then assert
    // the UI shows it for that (active) project.
    const project = await api.createProject(`Toggle Target ${Date.now()}`, endpointId);
    const start = await api.getSearchSettings(project.id);
    const target = !start.autoReindexOnChange;
    await api.updateSearchSettings(project.id, { ...start, autoReindexOnChange: target });

    await activateProject(page, project.id);
    await page.getByTestId('settings-nav-search').click();

    const toggle = page.getByTestId('toggle-row-autoReindex').getByRole('switch');
    await expect(toggle).toHaveAttribute('aria-checked', String(target));
  });
});
