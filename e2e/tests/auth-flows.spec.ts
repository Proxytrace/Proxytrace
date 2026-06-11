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
//   • There is no dedicated `/login` route. When unauthenticated, `LocalAuthGate` renders the
//     <Login/> form in place for ANY path (except /signup, /setup) WITHOUT rewriting the URL.
//     So hitting a protected route while logged-out shows the login form but keeps the URL.
//   • Logout calls `signoutRedirect()` which clears the token then `navigate('/login')`, so the
//     URL becomes /login and the login form renders.
//   • The JWT lives in localStorage key `proxytrace.token` (see auth.setup.spec.ts).
//   • There is NO server logout endpoint — logout is purely client-side (token removal).
const ADMIN_EMAIL = 'admin@e2e.test';
const ADMIN_PASSWORD = 'E2ePassword1!';
const TOKEN_KEY = 'proxytrace.token';

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
    // The token was persisted to localStorage.
    const token = await page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY);
    expect(token).toBeTruthy();
  });

  test('an invalid password shows an error, stays on /login, and issues no token', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'load' });

    await page.getByTestId('login-email').fill(ADMIN_EMAIL);
    await page.getByTestId('login-password').fill('totally-wrong-password');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('navigation')).toHaveCount(0);
    const token = await page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY);
    expect(token).toBeNull();
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
    const token = await page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY);
    expect(token).toBeNull();
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
    const token = await page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY);
    expect(token).toBeTruthy();
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
    await expect(page.getByRole('menuitem', { name: 'Settings' })).toHaveCount(0);
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
