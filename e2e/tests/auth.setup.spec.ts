import { test as setup, expect } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';

const AUTH_FILE = '.auth/storageState.json';
const ADMIN_EMAIL = 'admin@e2e.test';
const ADMIN_PASSWORD = 'E2ePassword1!';

setup('create first admin and persist session', async ({ page, request }) => {
  const api = new ProxytraceApiClient(request);

  const mode = await api.getAuthMode();
  expect(mode.setupRequired, 'expected empty database — run `docker compose down -v` first').toBe(true);

  const { token } = await api.setupAdmin(ADMIN_EMAIL, ADMIN_PASSWORD);
  expect(token).toBeTruthy();

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate((t) => localStorage.setItem('proxytrace.token', t), token);
  // Reload so the app reads the token from localStorage and routes away from login.
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({ path: AUTH_FILE });
});
