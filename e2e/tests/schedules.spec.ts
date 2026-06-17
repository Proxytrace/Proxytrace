import { test, expect } from '../helpers/fixtures';
import type { APIRequestContext } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';

// Scheduled test runs (the "Scheduled" tab on the /runs page). Creating a schedule is gated behind
// the ScheduledTestRuns (Enterprise) license feature; the default e2e stack (the `core` project,
// :5101) is Enterprise-licensed, so the "New schedule" button is enabled here. (The Free-tier
// :5103 stack is exercised separately by licensing.spec.ts.)
//
// This spec drives the full create flow through the UI: seed prerequisites (agent + evaluator +
// suite with the setup endpoint) via the API, then switch to the Scheduled tab, open the dialog,
// fill name/suite/endpoint/interval, submit, and assert the new schedule card renders with its
// name, the cadence label derived from the interval, and an (initially empty) recent-runs area.
//
// Stable data-testids: `schedules-tab` (the tab trigger), `schedules-section`,
// `schedule-create-btn`, the dialog (`schedule-form`, `schedule-name-input`,
// `schedule-suite-select` + `schedule-suite-select-option-<suiteId>`, `schedule-endpoint-<id>`,
// `schedule-interval-value`, `schedule-interval-unit` + `schedule-interval-unit-option-<unit>`,
// `modal-submit`), and the result card (`schedule-card-<id>`, `schedule-name-<id>`).

function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

/** Fresh, authenticated client for a test's own `request` fixture. */
async function makeClient(request: APIRequestContext): Promise<ProxytraceApiClient> {
  const client = new ProxytraceApiClient(request);
  const { token } = await client.login('admin@e2e.test', 'E2ePassword1!');
  client.setToken(token);
  return client;
}

test.describe('Scheduled test runs', () => {
  let api: ProxytraceApiClient;
  let endpointId: string;
  let projectId: string;
  let suiteId: string;
  let suiteName: string;

  test.beforeEach(async ({ request }) => {
    // The DB is reset to the setup baseline before each core test, so seed everything this test
    // needs here. The setup endpoint/project survive the reset; resolve them deterministically.
    api = await makeClient(request);
    endpointId = await api.firstEndpointId();
    projectId = await api.firstProjectId();

    const agent = await api.createAgent({ name: uniqueName('E2E Schedule Agent'), endpointId });
    const evaluator = await api.createEvaluator(projectId);
    suiteName = uniqueName('E2E Schedule Suite');
    ({ id: suiteId } = await api.createTestSuite(suiteName, agent.id, [evaluator.id], [
      { userContent: 'ping', expectedContent: 'pong' },
    ]));
  });

  test('create a schedule from the Scheduled tab', async ({ page }) => {
    const scheduleName = uniqueName('Nightly E2E');

    await page.goto('/runs', { waitUntil: 'load' });

    // Switch to the Scheduled tab and confirm the section rendered.
    await page.getByTestId('schedules-tab').click();
    await expect(page.getByTestId('schedules-section')).toBeVisible();
    // Enterprise stack → the create button is present (not the upgrade CTA).
    await expect(page.getByTestId('schedule-create-btn')).toBeVisible();

    // Open the New schedule dialog.
    await page.getByTestId('schedule-create-btn').click();
    const dialog = page.getByTestId('modal-panel');
    await expect(dialog.getByTestId('schedule-form')).toBeVisible();

    // Name.
    await dialog.getByTestId('schedule-name-input').fill(scheduleName);

    // Suite (custom Radix Select: click the trigger, then the option).
    await dialog.getByTestId('schedule-suite-select').click();
    await page.getByTestId(`schedule-suite-select-option-${suiteId}`).click();

    // Endpoint (multi-select row toggle) — pick the setup endpoint.
    await dialog.getByTestId(`schedule-endpoint-${endpointId}`).click();

    // Interval: 6 hours → 360 minutes → "Every 6h" cadence label.
    await dialog.getByTestId('schedule-interval-value').fill('6');
    await dialog.getByTestId('schedule-interval-unit').click();
    await page.getByTestId('schedule-interval-unit-option-hours').click();

    // Submit and let the dialog close.
    await dialog.getByTestId('modal-submit').click();
    await expect(page.getByTestId('schedule-form')).toBeHidden();

    // The new schedule should be returned by the API and rendered as a card. Poll the API until it
    // appears, then resolve the exact id so the card locator is unambiguous regardless of ordering.
    await expect
      .poll(
        async () => (await api.listTestRunSchedules({ projectId })).some(s => s.name === scheduleName),
        { message: 'schedule was not created' },
      )
      .toBe(true);

    const created = (await api.listTestRunSchedules({ projectId })).find(s => s.name === scheduleName);
    if (!created) throw new Error('schedule disappeared after creation');

    expect(created.intervalMinutes).toBe(360);
    expect(created.suiteId).toBe(suiteId);
    expect(created.recentRuns).toHaveLength(0);

    const card = page.getByTestId(`schedule-card-${created.id}`);
    await expect(card).toBeVisible();
    await expect(card.getByTestId(`schedule-name-${created.id}`)).toHaveText(scheduleName);
    // Cadence label from formatInterval(360) and the suite name both render on the card.
    await expect(card).toContainText('Every 6h');
    await expect(card).toContainText(suiteName);
    // Recent-runs area starts empty.
    await expect(card).toContainText('No runs yet');
  });
});
