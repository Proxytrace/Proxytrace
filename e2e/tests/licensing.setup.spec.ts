import { test as setup, expect } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';

// Authenticates the browser against the Free-tier stack (frontend-free / api-free on :5103) and
// saves a storageState for THAT origin. The default `setup` project already created the admin and
// completed setup; api-free shares the same database, so this spec only has to log in — no
// first-admin / setup flow. A separate storageState is needed because Playwright keys localStorage
// (where the token lives) by origin, and the Enterprise state is saved for :5101.
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
  await page.evaluate((t) => localStorage.setItem('proxytrace.token', t), token);
  await page.reload({ waitUntil: 'load' });
  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({ path: AUTH_FILE });
});
