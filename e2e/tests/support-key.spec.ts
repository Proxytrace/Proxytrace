import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// The Enterprise support key. Nothing is gated on it — every feature is always available — so the
// only behaviour to pin is that a key on file is reported correctly: the API snapshot and the
// topbar chip. The e2e overlay injects a committed throwaway Enterprise key (PROXYTRACE_LICENSE in
// docker-compose.e2e.yml), signed with the test key the stack's images trust.
test.describe('Enterprise support key', () => {
  test('the API reports the environment-supplied support key as active', async ({ request }) => {
    const api = new ProxytraceApiClient(request);
    const license = await api.getLicense();
    expect(license.tier).toBe('enterprise');
    expect(license.status).toBe('active');
    expect(license.source).toBe('environment');
  });

  test('the topbar shows the support chip and the settings page shows the contract', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    const badge = page.getByTestId('license-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('Enterprise support');

    await page.goto('/settings/license', { waitUntil: 'load' });
    await expect(page.getByTestId('settings-license')).toBeVisible();
    await expect(page.getByTestId('license-tier')).toContainText('Enterprise support');
    await expect(page.getByTestId('license-status')).toContainText('Active');
  });
});
