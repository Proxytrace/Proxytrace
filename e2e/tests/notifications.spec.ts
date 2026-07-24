import { randomUUID } from 'node:crypto';
import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// A notification is the *only* record of a detected anomaly — there is no Anomaly entity — so the
// detail drawer, not the target's list page, is where it is read. These specs cover the bell →
// row → drawer path, the `?notification=` deep link an emailed link redirects to, the target
// summary (including a target that was deleted), and mark-read/dismiss.
//
// The per-test DB reset truncates NotificationEntity, so each test starts with an empty inbox.
test.describe('Notifications', () => {
  let api: ProxytraceApiClient;
  let projectId: string;
  let endpointId: string;

  const LONG_MESSAGE =
    "In suite 'Checkout flow', pass rate on 'refund path' dropped 23 points (from 91% to 68%); " +
    "average latency on 'gpt-4o-mini' rose to 2.4x its baseline over the last 3 runs, and two " +
    'cases now time out that previously passed within budget.';

  test.beforeEach(async ({ request }) => {
    api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);
    projectId = await api.firstProjectId();
    endpointId = await api.firstEndpointId();
  });

  async function openBell(page: import('@playwright/test').Page) {
    await page.goto('/dashboard', { waitUntil: 'load' });
    await page.getByTestId('notifications-menu-trigger').click();
    await expect(page.getByTestId('notifications-panel')).toBeVisible();
  }

  test('bell row opens the drawer with the full, untruncated message', async ({ page }) => {
    const seeded = await api.seedNotification({
      projectId,
      title: `E2E pass-rate drop ${Date.now()}`,
      message: LONG_MESSAGE,
      severity: 'Critical',
    });

    await openBell(page);
    await page.getByTestId(`notification-row-${seeded.id}`).click();

    // The popover must close so the drawer (lower z-index) is actually visible.
    await expect(page.getByTestId('notifications-panel')).toBeHidden();
    await expect(page.getByTestId('notification-detail')).toBeVisible();
    await expect(page.getByTestId('notification-detail-message')).toHaveText(LONG_MESSAGE);
    await expect(page.getByTestId('notification-fields')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`notification=${seeded.id}`));
  });

  test('opening a notification marks it read', async ({ page }) => {
    const seeded = await api.seedNotification({
      projectId,
      title: `E2E unread ${Date.now()}`,
      message: 'Opening this must clear the unread badge.',
    });
    expect(seeded.status).toBe('Unread');

    await openBell(page);
    await page.getByTestId(`notification-row-${seeded.id}`).click();
    await expect(page.getByTestId('notification-detail')).toBeVisible();

    await expect
      .poll(async () => (await api.getNotification(seeded.id)).status, {
        timeout: 15_000,
        intervals: [250, 500, 1_000],
        message: 'opening the notification never marked it read',
      })
      .toBe('Read');
    await expect(page.getByTestId('notifications-unread-badge')).toBeHidden();
  });

  test('summarises a live target and links to it', async ({ page }) => {
    const agentName = `E2E Notified Agent ${Date.now()}`;
    const agent = await api.createAgent({
      name: agentName,
      endpointId,
      systemMessage: `You are notification target ${randomUUID()}.`,
    });
    const seeded = await api.seedNotification({
      projectId,
      title: `E2E agent anomaly ${Date.now()}`,
      message: 'This agent started erroring.',
      targetKind: 'Agent',
      targetId: agent.id,
    });

    await page.goto(`/dashboard?notification=${seeded.id}`, { waitUntil: 'load' });

    await expect(page.getByTestId('notification-target-title')).toHaveText(agentName);
    await expect(page.getByTestId('notification-target-cta')).toBeVisible();
    await expect(page.getByTestId('notification-target-missing')).toBeHidden();
  });

  test('deleted target degrades to a placeholder with no link', async ({ page }) => {
    // TargetId is a soft reference: the target can be deleted while the notification survives.
    const seeded = await api.seedNotification({
      projectId,
      title: `E2E dangling target ${Date.now()}`,
      message: 'The run this points at was deleted.',
      targetKind: 'TestRunGroup',
      targetId: randomUUID(),
    });

    await page.goto(`/dashboard?notification=${seeded.id}`, { waitUntil: 'load' });

    await expect(page.getByTestId('notification-target-missing')).toBeVisible();
    await expect(page.getByTestId('notification-target-cta')).toBeHidden();
  });

  test('the emailed /notifications/<id> link opens the drawer on a cold load', async ({ page }) => {
    const title = `E2E email link ${Date.now()}`;
    const seeded = await api.seedNotification({ projectId, title, message: 'Sent by email.' });

    await page.goto(`/notifications/${seeded.id}`, { waitUntil: 'load' });

    await expect(page).toHaveURL(new RegExp(`/dashboard\\?notification=${seeded.id}`));
    await expect(page.getByTestId('notification-detail')).toBeVisible();
    await expect(page.getByTestId('notification-detail-message')).toHaveText('Sent by email.');
  });

  test('a dismissed notification is gone from the bell but still deep-linkable', async ({ page }) => {
    const seeded = await api.seedNotification({
      projectId,
      title: `E2E dismissed ${Date.now()}`,
      message: 'Dismissed, but the record survives.',
    });
    await api.dismissNotification(seeded.id);

    // The list endpoint hard-excludes dismissed rows…
    expect(await api.listNotifications({ projectId })).not.toContainEqual(
      expect.objectContaining({ id: seeded.id }),
    );

    // …so only the by-id endpoint can serve the link.
    await page.goto(`/dashboard?notification=${seeded.id}`, { waitUntil: 'load' });
    await expect(page.getByTestId('notification-detail')).toBeVisible();
    await expect(page.getByTestId('notification-detail-message')).toHaveText('Dismissed, but the record survives.');
    await expect(page.getByTestId('notification-detail-dismiss-btn')).toBeHidden();
  });

  test('dismissing from the drawer closes it and drops the row', async ({ page }) => {
    const seeded = await api.seedNotification({
      projectId,
      title: `E2E dismiss from drawer ${Date.now()}`,
      message: 'Dismiss me.',
    });

    await openBell(page);
    await page.getByTestId(`notification-row-${seeded.id}`).click();
    await page.getByTestId('notification-detail-dismiss-btn').click();

    await expect(page.getByTestId('notification-detail')).toBeHidden();
    await expect
      .poll(async () => (await api.getNotification(seeded.id)).status, {
        timeout: 15_000,
        intervals: [250, 500, 1_000],
        message: 'dismiss never reached the server',
      })
      .toBe('Dismissed');

    await page.getByTestId('notifications-menu-trigger').click();
    await expect(page.getByTestId(`notification-row-${seeded.id}`)).toBeHidden();
  });

  test('an unknown notification id is a 404, not a leak', async () => {
    const res = await api.notificationResponse(randomUUID());
    expect(res.status()).toBe(404);
  });
});
