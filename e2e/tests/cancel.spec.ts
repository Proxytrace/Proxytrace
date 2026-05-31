import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// Cancel flow is intentionally NON-@llm. Cancelling a run group does not require a real model
// round-trip: the cancel endpoint flips the group/runs to a terminal state regardless of where
// inference is. Without OPENAI_API_KEY, upstream inference 401s and a run may reach a terminal
// Failed state quickly — racing the cancel. We therefore accept ANY terminal state for the
// poll (Cancelled is the goal) and separately assert the cancel endpoint itself returned 2xx.
test.describe('test run cancel', () => {
  test('cancel run group reaches a terminal state and cancel endpoint returns 2xx', async ({ request }) => {
    test.setTimeout(60_000);

    const client = new ProxytraceApiClient(request);
    const { token } = await client.login('admin@e2e.test', 'E2ePassword1!');
    client.setToken(token);

    // Seed prerequisites: an agent against the default endpoint + a suite with inline cases.
    const endpointId = await client.firstEndpointId();
    const projectId = await client.firstProjectId();
    const { id: agentId } = await client.createAgent({ name: `Cancel Agent ${Date.now()}`, endpointId });
    const { id: evaluatorId } = await client.createEvaluator(projectId);
    const { id: suiteId } = await client.createTestSuite('E2E Cancel Suite', agentId, [evaluatorId], [
      { userContent: 'Reply with exactly: pong', expectedContent: 'pong' },
      { userContent: 'Reply with exactly: ping', expectedContent: 'ping' },
    ]);

    // Start the run group, then cancel it immediately.
    const { id: groupId } = await client.createTestRunGroup(suiteId, [endpointId]);

    // Drive cancel via the API client right away. This resolves only on a 2xx response, which is
    // itself the assertion that the cancel endpoint succeeded.
    const cancelled = await client.cancelTestRunGroup(groupId);
    expect(cancelled.id).toBe(groupId);

    // The group must converge to a terminal state. Cancelled is the goal, but without a real LLM
    // the run can independently Fail/Complete first — accept any terminal state to avoid flakiness.
    await expect
      .poll(async () => (await client.getTestRunGroup(groupId)).status, {
        timeout: 30_000,
        intervals: [1_000],
        message: 'run group did not reach a terminal state after cancel',
      })
      .toMatch(/Cancelled|Failed|Completed/);
  });

  test('Runs UI surfaces a cancel affordance or a terminal status pill for the group', async ({ page, request }) => {
    test.setTimeout(60_000);

    const client = new ProxytraceApiClient(request);
    const { token } = await client.login('admin@e2e.test', 'E2ePassword1!');
    client.setToken(token);

    const endpointId = await client.firstEndpointId();
    const projectId = await client.firstProjectId();
    const { id: agentId } = await client.createAgent({ name: `Cancel UI Agent ${Date.now()}`, endpointId });
    const { id: evaluatorId } = await client.createEvaluator(projectId);
    const { id: suiteId } = await client.createTestSuite('E2E Cancel UI Suite', agentId, [evaluatorId], [
      { userContent: 'Reply with exactly: pong', expectedContent: 'pong' },
    ]);

    const { id: groupId } = await client.createTestRunGroup(suiteId, [endpointId]);

    await page.goto('/runs', { waitUntil: 'load' });

    // The group card is present in the left-hand list; select it to render the detail header.
    const card = page.getByTestId(`group-list-card-${groupId}`);
    await expect(card).toBeVisible({ timeout: 10_000 });
    await page.getByTestId(`group-list-card-btn-${groupId}`).click();

    const statusPill = page.getByTestId(`group-status-${groupId}`);
    await expect(statusPill).toBeVisible();

    // The header's Cancel button renders only while the group is still active; once any run
    // reaches a terminal state it disappears. Assert EITHER state holds: a cancel affordance for
    // a non-terminal run, OR the status pill reflects a terminal/cancelled state.
    const cancelBtn = page.getByTestId(`run-cancel-btn-${groupId}`);
    await expect
      .poll(
        async () => {
          const cancelVisible = await cancelBtn.isVisible().catch(() => false);
          const status = (await statusPill.textContent().catch(() => '')) ?? '';
          const terminal = /Cancelled|Failed|Completed/.test(status);
          return cancelVisible || terminal;
        },
        {
          timeout: 30_000,
          intervals: [1_000],
          message: 'expected a cancel button for an active run or a terminal status pill',
        },
      )
      .toBe(true);
  });
});
