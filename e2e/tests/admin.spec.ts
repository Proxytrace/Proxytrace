import { test, expect } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';

// Admin / Invites page (/admin/invites) — todo section 13.
// The route is isAdmin-gated client-side (App.tsx only registers it when the current user
// is a local-mode Admin) and the backend endpoints carry [Authorize(Roles = Admin)].
//
// The shared browser session (storageState) belongs to the admin created by auth.setup.
// For the non-admin redirect we cannot reuse that session, so we mint a real Member user
// (invite → signup) and drive a fresh, separately-authenticated browser context.

const ADMIN_EMAIL = 'admin@e2e.test';
const ADMIN_PASSWORD = 'E2ePassword1!';
const MEMBER_PASSWORD = 'E2eMember1!';

test.describe('Admin / Invites', () => {
  let api: ProxytraceApiClient;

  test.beforeAll(async ({ request }) => {
    api = new ProxytraceApiClient(request);
    const { token } = await api.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    api.setToken(token);
  });

  test('admin issues an invite that appears in the list with pending status', async ({ page }) => {
    const email = `invitee-${Date.now()}@e2e.test`;

    await page.goto('/admin/invites', { waitUntil: 'load' });
    await expect(page.getByTestId('invite-list')).toBeVisible();

    await page.getByTestId('invite-email-input').fill(email);
    await page.getByTestId('invite-role-select').selectOption('Member');
    await page.getByTestId('invite-create-btn').click();

    // The created invite surfaces a share link and a new pending row.
    await expect(page.getByText(email)).toBeVisible();

    // Locate the invite id via the API and assert the row + status reflect it.
    const invites = await api.listInvites();
    const created = invites.find((i) => i.email === email);
    expect(created, 'invite should be persisted').toBeTruthy();
    if (!created) return;

    await expect(page.getByTestId(`invite-row-${created.id}`)).toBeVisible();
    await expect(page.getByTestId(`invite-status-${created.id}`)).toHaveText('Pending');
  });

  test('admin revokes an invite and the row is removed', async ({ page }) => {
    // Seed an invite through the API so the test owns its own row.
    const email = `revoke-${Date.now()}@e2e.test`;
    await api.inviteUser(email, 'Member');
    const created = (await api.listInvites()).find((i) => i.email === email);
    expect(created, 'invite should be persisted').toBeTruthy();
    if (!created) return;

    await page.goto('/admin/invites', { waitUntil: 'load' });
    await expect(page.getByTestId(`invite-row-${created.id}`)).toBeVisible();

    await page.getByTestId(`invite-revoke-btn-${created.id}`).click();

    // Revoke deletes the invite — the row disappears from the table…
    await expect(page.getByTestId(`invite-row-${created.id}`)).toHaveCount(0);
    // …and from the API read-back.
    await expect
      .poll(async () => (await api.listInvites()).map((i) => i.id))
      .not.toContain(created.id);
  });

  test('non-admin is redirected away from /admin/invites and blocked at the API', async ({
    browser,
    request,
  }) => {
    // 1. Admin mints a Member invite.
    const memberEmail = `member-${Date.now()}@e2e.test`;
    const invite = await api.inviteUser(memberEmail, 'Member');

    // 2. Consume the invite via the public signup endpoint to create a real non-admin user.
    //    (No api-client method exists for signup; call the raw endpoint directly.)
    const signupRes = await request.post('/api/auth/signup', {
      data: { token: invite.token, password: MEMBER_PASSWORD },
    });
    expect(signupRes.ok(), `signup failed: ${signupRes.status()}`).toBeTruthy();
    const { token: memberToken } = (await signupRes.json()) as { token: string };
    expect(memberToken).toBeTruthy();

    // 3. API-level guard: the Member token is rejected by the admin-only invites endpoint.
    const adminEndpointRes = await request.get('/api/auth/invites', {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(adminEndpointRes.status()).toBe(403);

    // 4. Browser-level guard: a fresh context authenticated as the Member never sees the
    //    /admin/invites route (App.tsx omits it for non-admins) and is redirected to the
    //    dashboard by the catch-all route. `browser.newContext()` does not inherit the
    //    project's baseURL, so pass it explicitly from the resolved project config.
    const baseURL = test.info().project.use.baseURL;
    const context = await browser.newContext({ baseURL });
    try {
      const memberPage = await context.newPage();
      await memberPage.goto('/', { waitUntil: 'load' });
      await memberPage.evaluate((t) => localStorage.setItem('proxytrace.token', t), memberToken);
      await memberPage.goto('/admin/invites', { waitUntil: 'load' });

      await expect(memberPage).toHaveURL(/\/dashboard$/);
      await expect(memberPage.getByTestId('invite-list')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
