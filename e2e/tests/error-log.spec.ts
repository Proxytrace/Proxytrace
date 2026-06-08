import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// The Error Log captures every backend Error/Critical log entry asynchronously
// (logger -> bounded channel -> ErrorLogWriter -> ApplicationError row). Specs drive a real
// capture via the test-only POST /api/test/log-error, poll the API until the row is persisted,
// then assert the admin-only /error-log UI reflects it.
test.describe('Error Log', () => {
  let api: ProxytraceApiClient;

  test.beforeEach(async ({ request }) => {
    api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);
  });

  async function waitForErrorPersisted(message: string) {
    await expect
      .poll(
        async () => (await api.listErrorLog({ pageSize: 100 })).items.some((e) => e.message === message),
        { timeout: 30_000, intervals: [500, 1_000, 2_000], message: `error "${message}" was never persisted` },
      )
      .toBe(true);
  }

  test('admin sees the Error Log nav entry', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    await expect(page.getByRole('link', { name: 'Error Log' })).toBeVisible();
  });

  test('captured backend error appears with stacktrace detail', async ({ page }) => {
    const marker = `E2E captured error ${Date.now()}`;
    await api.logBackendError(marker);
    await waitForErrorPersisted(marker);

    await page.goto('/error-log', { waitUntil: 'load' });
    await expect(page.getByTestId('error-log-table')).toBeVisible();

    const row = page.getByText(marker).first();
    await expect(row).toBeVisible();
    await row.click();

    await expect(page.getByTestId('error-log-detail')).toBeVisible();
    await expect(page.getByTestId('error-log-stacktrace')).toContainText('InvalidOperationException');
  });

  test('level filter narrows to critical errors only', async ({ page }) => {
    const errorMarker = `E2E error-level ${Date.now()}`;
    const criticalMarker = `E2E critical-level ${Date.now()}`;
    await api.logBackendError(errorMarker, false);
    await api.logBackendError(criticalMarker, true);
    await waitForErrorPersisted(errorMarker);
    await waitForErrorPersisted(criticalMarker);

    await page.goto('/error-log', { waitUntil: 'load' });
    await expect(page.getByText(criticalMarker)).toBeVisible();
    await expect(page.getByText(errorMarker)).toBeVisible();

    await page.getByRole('button', { name: 'Critical' }).click();

    await expect(page.getByText(criticalMarker)).toBeVisible();
    await expect(page.getByText(errorMarker)).toHaveCount(0);
  });
});
