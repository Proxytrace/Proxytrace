import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';
import { computeTotp } from '../helpers/totp';

const ADMIN_EMAIL = 'admin@e2e.test';
const ADMIN_PASSWORD = 'E2ePassword1!';

// MFA is enabled on the shared e2e admin; the per-test DB reset truncates the enrollment + backup
// codes (see TestDataReset), so every test starts from a clean, MFA-disabled baseline.
test.describe('Two-factor authentication', () => {
  let api: ProxytraceApiClient;

  test.beforeEach(async ({ request }) => {
    api = new ProxytraceApiClient(request);
    const { token } = await api.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    api.setToken(token);
  });

  // Restore the shared admin to its MFA-disabled baseline after each test. The per-test reset only
  // runs *before* a test, so without this the admin would stay behind a second factor for whatever
  // runs next — and a project that does not reset (auth-flows) would then fail its password login.
  // Reset is anonymous (test-only), so it works even though this account now needs an MFA challenge.
  test.afterEach(async ({ request }) => {
    await request.post('/api/test/reset');
  });

  test('enabling MFA gates sign-in behind a second factor, satisfied by a backup code', async ({ page }) => {
    // Enroll over the API: fetch a secret, confirm it with a freshly computed TOTP code.
    const { secret } = await api.mfaSetup();
    const { backupCodes } = await api.mfaActivate(computeTotp(secret));
    expect(backupCodes).toHaveLength(10);

    // The account page reflects the enabled state.
    await page.goto('/account', { waitUntil: 'load' });
    await expect(page.getByTestId('mfa-disable-btn')).toBeVisible();

    // Start a fresh browser session and sign in: password alone now yields the MFA challenge.
    await page.context().clearCookies();
    await page.goto('/login', { waitUntil: 'load' });
    await page.getByTestId('login-email').fill(ADMIN_EMAIL);
    await page.getByTestId('login-password').fill(ADMIN_PASSWORD);
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('mfa-challenge-form')).toBeVisible();

    // A backup code completes the second factor and lands the user in the app.
    await page.getByTestId('mfa-code-input').fill(backupCodes[0]);
    await page.getByTestId('mfa-verify-submit').click();

    await expect(page.getByTestId('user-menu-trigger')).toBeVisible();
  });

  test('a wrong second-factor code is rejected', async ({ page }) => {
    const { secret } = await api.mfaSetup();
    await api.mfaActivate(computeTotp(secret));

    await page.context().clearCookies();
    await page.goto('/login', { waitUntil: 'load' });
    await page.getByTestId('login-email').fill(ADMIN_EMAIL);
    await page.getByTestId('login-password').fill(ADMIN_PASSWORD);
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('mfa-challenge-form')).toBeVisible();
    await page.getByTestId('mfa-code-input').fill('000000');
    await page.getByTestId('mfa-verify-submit').click();

    await expect(page.getByTestId('mfa-error')).toBeVisible();
    await expect(page.getByTestId('mfa-challenge-form')).toBeVisible();
  });
});
