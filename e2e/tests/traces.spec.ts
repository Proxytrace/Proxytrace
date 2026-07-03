import { test, expect } from '../helpers/fixtures';
import type { APIRequestContext } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';
import { selectAgentFilter } from '../helpers/traces-ui';

// Traces page (/traces) coverage.
//
// Seeding notes:
//  - api.seedAgentCall builds a captured call directly. The seeded call's model is the agent's
//    endpoint model (the setup default, 'gpt-4o-mini'), NOT a custom DTO string — so we never
//    assert a custom model.
//  - The traces table groups calls that SHARE a conversationId into ConversationGroupRow; the
//    seed endpoint always sets conversationId = null, so every seeded trace renders as a
//    FlatTraceRow. There is no UI "grouping toggle" — grouping is automatic and data-driven.
//    The "conversation grouping toggle" todo item is therefore NOT implementable through the
//    available seed path (see the report). We assert flat rows render instead.

function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function makeClient(request: APIRequestContext): Promise<ProxytraceApiClient> {
  const client = new ProxytraceApiClient(request);
  const { token } = await client.login('admin@e2e.test', 'E2ePassword1!');
  client.setToken(token);
  return client;
}

test.describe('Traces', () => {
  let endpointId: string;
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    const api = await makeClient(request);
    endpointId = await api.firstEndpointId();
    projectId = await api.firstProjectId();
  });

  test('TraceTable lists seeded traces', async ({ page, request }) => {
    const client = await makeClient(request);

    const agentName = uniqueName('List Agent');
    const { id: agentId } = await client.createAgent({ name: agentName, endpointId });
    const calls: Array<{ id: string }> = [];
    for (let i = 0; i < 3; i++) {
      calls.push(await client.seedAgentCall({ agentId, userContent: `list trace ${i}`, assistantContent: `resp ${i}` }));
    }

    await page.goto('/traces', { waitUntil: 'load' });
    await expect(page.getByTestId('trace-table')).toBeVisible();

    // Filter to this agent so the assertion is independent of other tests' data.
    await selectAgentFilter(page, agentId);

    for (const c of calls) {
      await expect(page.getByTestId(`trace-row-${c.id}`)).toBeVisible();
    }
  });

  test('clicking a trace row opens the detail drawer with messages and metadata', async ({ page, request }) => {
    const client = await makeClient(request);

    const agentName = uniqueName('Detail Agent');
    const { id: agentId } = await client.createAgent({ name: agentName, endpointId });
    const userText = `detail unique ${Date.now()}`;
    const call = await client.seedAgentCall({ agentId, userContent: userText, assistantContent: 'detail reply here' });

    await page.goto('/traces', { waitUntil: 'load' });
    await selectAgentFilter(page, agentId);

    await page.getByTestId(`trace-row-${call.id}`).click();

    // Drawer opens, defaulting to the Messages tab.
    const drawer = page.getByTestId('trace-detail');
    await expect(drawer).toBeVisible();

    // Messages tab shows the conversation content.
    const messagesTab = page.getByTestId('trace-messages-tab');
    await expect(messagesTab).toBeVisible();
    await expect(messagesTab).toContainText(userText);
    await expect(messagesTab).toContainText('detail reply here');

    // Switch to the Metadata tab.
    await page.getByTestId('trace-tab-metadata').click();
    const metadataTab = page.getByTestId('trace-metadata-tab');
    await expect(metadataTab).toBeVisible();
    await expect(metadataTab).toContainText('model');
    await expect(metadataTab).toContainText('http_status');
  });

  test('agent filter narrows the table to a single agent', async ({ page, request }) => {
    const client = await makeClient(request);

    const agentAName = uniqueName('Filter Agent A');
    const agentBName = uniqueName('Filter Agent B');
    const { id: agentAId } = await client.createAgent({ name: agentAName, endpointId });
    const { id: agentBId } = await client.createAgent({ name: agentBName, endpointId });

    const callA = await client.seedAgentCall({ agentId: agentAId, userContent: 'from A', assistantContent: 'a' });
    const callB = await client.seedAgentCall({ agentId: agentBId, userContent: 'from B', assistantContent: 'b' });

    await page.goto('/traces', { waitUntil: 'load' });
    await expect(page.getByTestId('trace-table')).toBeVisible();

    // Filter to agent A: A's trace is visible, B's is not.
    await selectAgentFilter(page, agentAId);
    await expect(page.getByTestId(`trace-row-${callA.id}`)).toBeVisible();
    await expect(page.getByTestId(`trace-row-${callB.id}`)).toBeHidden();
  });

  test('seeded traces render as flat rows (no automatic conversation grouping)', async ({ page, request }) => {
    // Seeded calls carry conversationId = null, so buildRows() emits FlatTraceRow for each.
    // This is the closest verifiable behaviour to the "grouping toggle" item, which has no UI.
    const client = await makeClient(request);

    const agentName = uniqueName('Flat Agent');
    const { id: agentId } = await client.createAgent({ name: agentName, endpointId });
    const c1 = await client.seedAgentCall({ agentId, userContent: 'flat one', assistantContent: 'r1' });
    const c2 = await client.seedAgentCall({ agentId, userContent: 'flat two', assistantContent: 'r2' });

    await page.goto('/traces', { waitUntil: 'load' });
    await selectAgentFilter(page, agentId);

    // Each seeded call is an individually-clickable flat row (not nested under a conversation).
    await expect(page.getByTestId(`trace-row-${c1.id}`)).toBeVisible();
    await expect(page.getByTestId(`trace-row-${c2.id}`)).toBeVisible();
  });

  test('promoting a trace adds a test case to the selected suite', async ({ page, request }) => {
    const client = await makeClient(request);

    const agentName = uniqueName('Promote Agent');
    const { id: agentId } = await client.createAgent({ name: agentName, endpointId });
    // A suite (with one seed case) is the promote destination.
    const seedCall = await client.seedAgentCall({ agentId, userContent: 'seed', assistantContent: 'seed-resp' });
    const { id: suiteId } = await client.createSuiteFromTraces(uniqueName('Promote Suite'), agentId, [seedCall.id], []);
    expect((await client.getTestSuite(suiteId)).testCases.length).toBe(1);

    // The trace we'll promote.
    const promoteCall = await client.seedAgentCall({
      agentId,
      userContent: `promote me ${Date.now()}`,
      assistantContent: 'promote reply',
    });

    await page.goto('/traces', { waitUntil: 'load' });
    await selectAgentFilter(page, agentId);

    await page.getByTestId(`trace-row-${promoteCall.id}`).click();
    await expect(page.getByTestId('trace-detail')).toBeVisible();

    await page.getByTestId('promote-btn').click();
    const modal = page.getByTestId('promote-modal');
    await expect(modal).toBeVisible();

    // Select the destination suite and submit.
    await page.getByTestId(`promote-suite-option-${suiteId}`).click();
    await page.getByTestId('promote-submit-btn').click();

    // Modal closes; suite's test-case count went 1 -> 2 (verify via API read-back).
    await expect(modal).toBeHidden();
    await expect.poll(
      async () => (await client.getTestSuite(suiteId)).testCases.length,
      { timeout: 10_000, message: 'promote did not add a test case' },
    ).toBe(2);
  });

  test('pagination shows the next page of traces', async ({ page, request }) => {
    const client = await makeClient(request);

    // PAGE_SIZE is 20; seed 25 calls for a single agent → two pages.
    const agentName = uniqueName('Paging Agent');
    const { id: agentId } = await client.createAgent({ name: agentName, endpointId });
    for (let i = 0; i < 25; i++) {
      await client.seedAgentCall({ agentId, userContent: `page trace ${i}`, assistantContent: `r${i}` });
    }

    await page.goto('/traces', { waitUntil: 'load' });
    // Filter to this agent so exactly 25 traces drive the pagination.
    await selectAgentFilter(page, agentId);
    await expect(page.getByTestId('trace-table')).toBeVisible();

    // Pagination control is present (total 25 > pageSize 20).
    const pager = page.getByTestId('trace-pagination');
    await expect(pager).toBeVisible();

    // Page 1 shows 20 rows for this agent.
    await expect.poll(
      async () => page.locator('[data-testid^="trace-row-"]').count(),
      { timeout: 10_000, message: 'page 1 should show a full page of rows' },
    ).toBe(20);

    // Advance to page 2 (the "→" next button).
    await pager.getByRole('button', { name: '→' }).click();

    // Page 2 shows the remaining 5 rows.
    await expect.poll(
      async () => page.locator('[data-testid^="trace-row-"]').count(),
      { timeout: 10_000, message: 'page 2 should show the remaining rows' },
    ).toBe(5);
  });
});
