import { test as setup, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// Authenticates the browser against the Free-tier stack (frontend-free / api-free on :5103) and
// saves a storageState for THAT origin. The default `setup` project already created the admin and
// completed setup; api-free shares the same database, so this spec only has to log in — no
// first-admin / setup flow. A separate storageState is needed because Playwright keys the session
// (an httpOnly cookie) by origin, and the Enterprise state is saved for :5101.
const AUTH_FILE = '.auth/licensing-state.json';
const ADMIN_EMAIL = 'admin@e2e.test';
const ADMIN_PASSWORD = 'E2ePassword1!';

setup('authenticate against the Free-tier stack', async ({ page, request }) => {
  const api = new ProxytraceApiClient(request);

  // Sanity-check the :5103 backend really is Free tier before we build state against it.
  const license = await api.getLicense();
  expect(license.tier, 'api-free must run the Free tier (no PROXYTRACE_LICENSE)').toBe('free');

  // baseURL is :5103, so this hits api-free; the admin exists in the shared DB.
  const { token } = await api.login(ADMIN_EMAIL, ADMIN_PASSWORD);
  expect(token).toBeTruthy();

  await page.goto('/', { waitUntil: 'load' });
  // The session is an httpOnly cookie (the SPA never persists the JWT itself) — inject it at the
  // browser-context level, then reload so the app restores the session via /api/auth/me.
  await page.context().addCookies([{
    name: 'proxytrace_session',
    value: token,
    url: new URL(page.url()).origin,
    httpOnly: true,
    sameSite: 'Strict',
  }]);
  await page.reload({ waitUntil: 'load' });
  // Assert on an authenticated element rather than the URL: the app renders the login form in place
  // without redirecting, so a not-/login check passes even while logged out. The Free stack always
  // shows the license badge once authenticated, so it is a reliable auth signal here.
  await expect(page.getByTestId('license-badge')).toBeVisible();

  await page.context().storageState({ path: AUTH_FILE });
});
