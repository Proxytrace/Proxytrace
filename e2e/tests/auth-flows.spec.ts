import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// Auth & access control (login / logout / protected-route gating / signup-via-invite).
//
// IMPORTANT: this spec exercises the *logged-out* browser, so it must NOT inherit the shared
// storageState. The lead wires this file into a Playwright project WITHOUT a storageState; we
// also defensively clear it at the describe level so the browser always starts signed-out even
// if the project config changes.
//
// App behaviour notes (verified against frontend/src/App.tsx + features/auth/*):
//   • When unauthenticated, `LocalAuthGate` renders the <Login/> form in place for ANY path
//     (except /signup, /setup, /login) WITHOUT rewriting the URL; /login is also a real route.
//   • Logout calls `signoutRedirect()` which POSTs /api/auth/logout (clears the cookie) and
//     navigates to /login.
//   • The session is an httpOnly cookie `proxytrace_session` set by the backend on login;
//     the JWT is never persisted to localStorage (see auth.setup.spec.ts).
const ADMIN_EMAIL = 'admin@e2e.test';
const ADMIN_PASSWORD = 'E2ePassword1!';
const SESSION_COOKIE = 'proxytrace_session';

test.describe('Auth & access control', () => {
  // Start every test from a clean, signed-out browser session.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('valid login lands on the dashboard', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'load' });

    await page.getByTestId('login-email').fill(ADMIN_EMAIL);
    await page.getByTestId('login-password').fill(ADMIN_PASSWORD);
    await page.getByTestId('login-submit').click();

    // Successful login navigates to '/', which redirects to /dashboard.
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page).not.toHaveURL(/\/login/);
    // The app chrome (sidebar nav) only mounts once authenticated.
    await expect(page.getByRole('navigation')).toBeVisible();
    // The session was persisted as the httpOnly cookie (not in localStorage).
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === SESSION_COOKIE)?.value).toBeTruthy();
    const stray = await page.evaluate(() => localStorage.getItem('proxytrace.token'));
    expect(stray).toBeNull();
  });

  test('an invalid password shows an error, stays on /login, and issues no token', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'load' });

    await page.getByTestId('login-email').fill(ADMIN_EMAIL);
    await page.getByTestId('login-password').fill('totally-wrong-password');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('navigation')).toHaveCount(0);
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === SESSION_COOKIE)).toBeUndefined();
  });

  test('the raw login endpoint rejects bad credentials with 401', async ({ request }) => {
    // api.login() throws on bad creds, so assert the status directly via the raw endpoint.
    const res = await request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: 'totally-wrong-password' },
    });
    expect(res.status()).toBe(401);
  });

  test('a logged-out user hitting a protected route is shown the login form, not the page', async ({ page }) => {
    // The app keeps the URL but renders <Login/> in place (no client redirect to /login),
    // so the protected page's chrome never mounts. Assert the login form is what renders.
    await page.goto('/agents', { waitUntil: 'load' });

    await expect(page.getByTestId('login-submit')).toBeVisible();
    // Protected app chrome (the sidebar nav) must NOT be present for an unauthenticated user.
    await expect(page.getByRole('navigation')).toHaveCount(0);
  });

  test('logout returns to /login and clears the session', async ({ page }) => {
    // Log in through the UI first.
    await page.goto('/login', { waitUntil: 'load' });
    await page.getByTestId('login-email').fill(ADMIN_EMAIL);
    await page.getByTestId('login-password').fill(ADMIN_PASSWORD);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Open the user menu in the app shell (the avatar button), then click Logout.
    await page.getByTestId('user-menu-trigger').click();
    await page.getByTestId('logout-btn').click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId('login-submit')).toBeVisible();
    // The server cleared the session cookie on logout.
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === SESSION_COOKIE)).toBeUndefined();
  });

  test('signup via an invite creates a user and logs them in', async ({ page, request }) => {
    // Mint an invite using an admin token (the invite endpoint is admin-only). The signup page
    // reads ?token= from the URL, previews the invite, then exchanges (token, password) for a
    // session — see features/auth/Signup.tsx.
    const api = new ProxytraceApiClient(request);
    const { token: adminToken } = await api.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    api.setToken(adminToken);

    const inviteEmail = `newuser+${Date.now()}@e2e.test`;
    const invite = await api.inviteUser(inviteEmail, 'Member');
    expect(invite.token).toBeTruthy();

    await page.goto(`/signup?token=${encodeURIComponent(invite.token)}`, { waitUntil: 'load' });

    // The signup form only renders once the invite preview loads. The email is fixed by the
    // invite — the field is locked (disabled) and shows the invited address, and the backend
    // ignores any client-supplied email regardless.
    await expect(page.getByTestId('signup-password')).toBeVisible();
    await expect(page.getByTestId('signup-email')).toBeDisabled();
    await expect(page.getByTestId('signup-email')).toHaveValue(inviteEmail);

    // Must satisfy the password policy (8+ chars, upper, lower, special — see auth/password.ts).
    await page.getByTestId('signup-password').fill('E2ePassword1!');
    await page.getByTestId('signup-submit').click();

    // A successful signup sets the token and navigates to '/', which lands on /dashboard.
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('navigation')).toBeVisible();
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === SESSION_COOKIE)?.value).toBeTruthy();
  });

  test('a Member sees no Settings nav and is redirected away from /settings', async ({ page, request }) => {
    // The whole settings hub (incl. Providers, Users, Error Log) is admin-only. A non-admin must
    // not see the Settings nav entry, and the settings routes aren't registered for them — so the
    // client router falls through to the dashboard. (The backend independently 403s the APIs.)
    const api = new ProxytraceApiClient(request);
    const { token: adminToken } = await api.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    api.setToken(adminToken);

    const memberEmail = `member+${Date.now()}@e2e.test`;
    const invite = await api.inviteUser(memberEmail, 'Member');

    // Redeem the invite via the UI, which signs the new Member in.
    await page.goto(`/signup?token=${encodeURIComponent(invite.token)}`, { waitUntil: 'load' });
    await page.getByTestId('signup-password').fill('E2ePassword1!');
    await page.getByTestId('signup-submit').click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // No Settings entry for a Member: the project-switcher menu's admin-only "Settings" item is
    // absent.
    await page.getByTestId('project-switcher').click();
    // Match the admin "Settings" item exactly — a non-exact name match also catches project
    // menuitems that merely contain the word (e.g. a project named "Settings List …").
    await expect(page.getByRole('menuitem', { name: 'Settings', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // Direct navigation to settings routes is not available to a Member → redirected to dashboard.
    await page.goto('/settings', { waitUntil: 'load' });
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto('/settings/providers', { waitUntil: 'load' });
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  // NOTE: the Free-tier 402 gate on the optimization-proposals route is covered in
  // licensing.spec.ts ('the optimization-proposals API is gated with HTTP 402'); not duplicated here.
});

// Forgot/reset-password flow. The reset link is exercised through the deterministic admin-issued
// path (no SMTP needed): an admin mints a one-time link, the user opens it and chooses a new
// password. See features/auth/{ForgotPassword,ResetPassword}.tsx + AuthController/UsersController.
test.describe('Password reset', () => {
  // Drive from a clean, signed-out browser session (the reset page is unauthenticated).
  test.use({ storageState: { cookies: [], origins: [] } });

  // Create a fresh local user with a known password via the invite flow; return its email + id.
  async function seedLocalUser(api: ProxytraceApiClient): Promise<{ email: string; id: string }> {
    const email = `reset+${Date.now()}-${Math.random().toString(36).slice(2)}@e2e.test`;
    const invite = await api.inviteUser(email, 'Member');
    await api.signup(invite.token, ADMIN_PASSWORD);
    return { email, id: await api.userIdByEmail(email) };
  }

  function tokenFromLink(link: string): string {
    const token = new URL(link).searchParams.get('token');
    if (!token) throw new Error(`reset link had no token: ${link}`);
    return token;
  }

  test('an admin-issued reset link lets a user set a new password and signs them in', async ({ page, request }) => {
    const api = new ProxytraceApiClient(request);
    const { token: adminToken } = await api.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    api.setToken(adminToken);

    const user = await seedLocalUser(api);
    const { link } = await api.createResetLink(user.id);

    await page.goto(`/reset-password?token=${encodeURIComponent(tokenFromLink(link))}`, { waitUntil: 'load' });

    const newPassword = 'E2eNewPass2@';
    await page.getByTestId('reset-password-input').fill(newPassword);
    await page.getByTestId('reset-password-submit').click();

    // A successful reset logs the user straight in → '/', which lands on /dashboard.
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('navigation')).toBeVisible();
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === SESSION_COOKIE)?.value).toBeTruthy();

    // Backend-verified: the new password authenticates and the old one no longer does.
    const relog = await api.login(user.email, newPassword);
    expect(relog.token).toBeTruthy();
    const oldPwd = await request.post('/api/auth/login', { data: { email: user.email, password: ADMIN_PASSWORD } });
    expect(oldPwd.status()).toBe(401);
  });

  test('an invalid reset token shows the invalid-link state, not the form', async ({ page }) => {
    await page.goto('/reset-password?token=not-a-real-token', { waitUntil: 'load' });
    await page.getByTestId('reset-password-input').fill('E2eNewPass2@');
    await page.getByTestId('reset-password-submit').click();
    await expect(page.getByTestId('reset-password-error')).toBeVisible();
    await expect(page).toHaveURL(/\/reset-password/);
  });

  test('forgot-password returns 202 for any email and never reveals which accounts exist', async ({ request }) => {
    const api = new ProxytraceApiClient(request);
    const known = await api.forgotPasswordResponse(ADMIN_EMAIL);
    const unknown = await api.forgotPasswordResponse(`ghost+${Date.now()}@e2e.test`);
    expect(known.status()).toBe(202);
    expect(unknown.status()).toBe(202);
  });

  test('a reset link is single-use', async ({ request }) => {
    const api = new ProxytraceApiClient(request);
    const { token: adminToken } = await api.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    api.setToken(adminToken);

    const user = await seedLocalUser(api);
    const token = tokenFromLink((await api.createResetLink(user.id)).link);

    const first = await api.resetPasswordResponse(token, 'E2eNewPass2@');
    expect(first.status()).toBe(200);
    const second = await api.resetPasswordResponse(token, 'E2eOther3#');
    expect(second.status()).toBe(410);
  });
});
