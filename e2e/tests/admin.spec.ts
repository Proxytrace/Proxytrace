import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// Admin / Users page (/admin/users) — user management + invites.
// The route is isAdmin-gated client-side (App.tsx only registers it when the current user
// is a local-mode Admin) and the backend endpoints carry [Authorize(Roles = Admin)].
//
// The shared browser session (storageState) belongs to the admin created by auth.setup.
// For the non-admin redirect we cannot reuse that session, so we mint a real Member user
// (invite → signup) and drive a fresh, separately-authenticated browser context.

const ADMIN_EMAIL = 'admin@e2e.test';
const ADMIN_PASSWORD = 'E2ePassword1!';
const MEMBER_PASSWORD = 'E2eMember1!';

test.describe('Admin / Users', () => {
  let api: ProxytraceApiClient;

  test.beforeEach(async ({ request }) => {
    api = new ProxytraceApiClient(request);
    const { token } = await api.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    api.setToken(token);
  });

  test('admin issues an invite that appears in the list with pending status', async ({ page }) => {
    const email = `invitee-${Date.now()}@e2e.test`;

    await page.goto('/admin/users', { waitUntil: 'load' });
    await expect(page.getByTestId('invite-list')).toBeVisible();

    await page.getByTestId('invite-email-input').fill(email);
    await page.getByTestId('invite-role-select').click();
    await page.getByTestId('invite-role-select-option-Member').click();
    await page.getByTestId('invite-create-btn').click();

    // The created invite surfaces a share link and a new pending row.
    await expect(page.getByText(email)).toBeVisible();

    const invites = await api.listInvites();
    const created = invites.find((i) => i.email === email);
    expect(created, 'invite should be persisted').toBeTruthy();
    if (!created) return;

    await expect(page.getByTestId(`invite-row-${created.id}`)).toBeVisible();
    await expect(page.getByTestId(`invite-status-${created.id}`)).toHaveText('Pending');
    // A pending invite exposes a copy-link control so the admin can re-share it later.
    await expect(page.getByTestId(`invite-copy-btn-${created.id}`)).toBeVisible();
  });

  test('admin revokes an invite and the row is removed', async ({ page }) => {
    const email = `revoke-${Date.now()}@e2e.test`;
    await api.inviteUser(email, 'Member');
    const created = (await api.listInvites()).find((i) => i.email === email);
    expect(created, 'invite should be persisted').toBeTruthy();
    if (!created) return;

    await page.goto('/admin/users', { waitUntil: 'load' });
    await expect(page.getByTestId(`invite-row-${created.id}`)).toBeVisible();

    await page.getByTestId(`invite-revoke-btn-${created.id}`).click();

    await expect(page.getByTestId(`invite-row-${created.id}`)).toHaveCount(0);
    await expect
      .poll(async () => (await api.listInvites()).map((i) => i.id))
      .not.toContain(created.id);
  });

  test('a used invite no longer appears in the pending list', async ({ page }) => {
    const email = `used-${Date.now()}@e2e.test`;
    const invite = await api.inviteUser(email, 'Member');
    const created = (await api.listInvites()).find((i) => i.email === email);
    expect(created).toBeTruthy();
    if (!created) return;

    // Visible while pending…
    await page.goto('/admin/users', { waitUntil: 'load' });
    await expect(page.getByTestId(`invite-row-${created.id}`)).toBeVisible();

    // …redeemed → it drops off the pending list on reload.
    await api.signup(invite.token, MEMBER_PASSWORD);
    await page.reload({ waitUntil: 'load' });
    await expect(page.getByTestId(`invite-row-${created.id}`)).toHaveCount(0);
  });

  test('a redeemed user appears in the list and a role change is reflected in the UI', async ({ page }) => {
    // Mint a real Member user: invite → signup.
    const email = `user-${Date.now()}@e2e.test`;
    const invite = await api.inviteUser(email, 'Member');
    await api.signup(invite.token, MEMBER_PASSWORD);
    const user = (await api.listUsers()).items.find((u) => u.email === email);
    expect(user, 'redeemed user should exist').toBeTruthy();
    if (!user) return;

    await page.goto('/admin/users', { waitUntil: 'load' });
    await expect(page.getByTestId(`user-row-${user.id}`)).toBeVisible();
    await expect(page.getByTestId(`user-role-select-${user.id}`)).toContainText('Member');

    // Promote through the API, then assert the UI reflects the new role on reload.
    await api.updateUserRole(user.id, 'Admin');
    await page.reload({ waitUntil: 'load' });
    await expect(page.getByTestId(`user-role-select-${user.id}`)).toContainText('Admin');
  });

  test('admin assigns a project to a user from the Users page', async ({ page }) => {
    const email = `assignee-${Date.now()}@e2e.test`;
    const invite = await api.inviteUser(email, 'Member');
    await api.signup(invite.token, MEMBER_PASSWORD);
    const user = (await api.listUsers()).items.find((u) => u.email === email);
    expect(user).toBeTruthy();
    if (!user) return;
    const projectId = await api.firstProjectId();

    await page.goto('/admin/users', { waitUntil: 'load' });
    await page.getByTestId(`user-projects-btn-${user.id}`).click();
    await expect(page.getByTestId('user-projects-modal')).toBeVisible();
    await page.getByTestId(`user-project-toggle-${projectId}`).click();

    // The membership lands server-side.
    await expect
      .poll(async () => (await api.getUserProjects(user.id)).map((p) => p.id))
      .toContain(projectId);
  });

  test('deleting a user requires typing their email to confirm', async ({ page }) => {
    const email = `delete-${Date.now()}@e2e.test`;
    const invite = await api.inviteUser(email, 'Member');
    await api.signup(invite.token, MEMBER_PASSWORD);
    const user = (await api.listUsers()).items.find((u) => u.email === email);
    expect(user).toBeTruthy();
    if (!user) return;

    await page.goto('/admin/users', { waitUntil: 'load' });
    await page.getByTestId(`user-delete-btn-${user.id}`).click();

    // Confirm stays disabled until the exact email is typed.
    const confirm = page.getByRole('button', { name: 'Remove user' });
    await expect(confirm).toBeDisabled();
    await page.getByTestId('confirm-input').fill(email);
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page.getByTestId(`user-row-${user.id}`)).toHaveCount(0);
    await expect
      .poll(async () => (await api.listUsers()).items.map((u) => u.email))
      .not.toContain(email);
  });

  test('the last admin cannot delete or demote themselves from the UI', async ({ page }) => {
    const admin = (await api.listUsers()).items.find((u) => u.email === ADMIN_EMAIL);
    expect(admin).toBeTruthy();
    if (!admin) return;

    await page.goto('/admin/users', { waitUntil: 'load' });
    await expect(page.getByTestId(`user-delete-btn-${admin.id}`)).toBeDisabled();
  });

  test('non-admin is redirected away from /admin/users and blocked at the API', async ({
    browser,
    request,
  }) => {
    const memberEmail = `member-${Date.now()}@e2e.test`;
    const invite = await api.inviteUser(memberEmail, 'Member');
    const { token: memberToken } = await api.signup(invite.token, MEMBER_PASSWORD);
    expect(memberToken).toBeTruthy();

    // API-level guard: the Member token is rejected by the admin-only invites endpoint.
    const adminEndpointRes = await request.get('/api/auth/invites', {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(adminEndpointRes.status()).toBe(403);

    // Browser-level guard: a fresh Member context never sees the /admin/users route.
    const baseURL = test.info().project.use.baseURL;
    const context = await browser.newContext({ baseURL });
    try {
      // The session rides in the httpOnly cookie — inject it at the context level.
      await context.addCookies([{
        name: 'proxytrace_session',
        value: memberToken,
        url: baseURL ?? 'http://localhost:5101',
        httpOnly: true,
        sameSite: 'Strict',
      }]);
      const memberPage = await context.newPage();
      await memberPage.goto('/admin/users', { waitUntil: 'load' });

      await expect(memberPage).toHaveURL(/\/dashboard$/);
      await expect(memberPage.getByTestId('user-list')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
