import { test, expect } from '../helpers/fixtures';
import type { APIRequestContext } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';
import { addTraceFilter, removeTraceFilter, selectAgentFilter, toggleSystemTraces } from '../helpers/traces-ui';

// Traces table column sorting + composable filter bar (/traces).
//
// The seed endpoint stamps OutlierFlags and tool names directly (bypassing ingestion), so anomaly
// and tool filters are testable without an LLM. Every test narrows to its own seeded agent first,
// making row-set assertions independent of any other data.

const HIGH_LATENCY = 2; // OutlierFlags.HighLatency

function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function makeClient(request: APIRequestContext): Promise<ProxytraceApiClient> {
  const client = new ProxytraceApiClient(request);
  const { token } = await client.login('admin@e2e.test', 'E2ePassword1!');
  client.setToken(token);
  return client;
}

/** Ids of the currently rendered trace rows, top to bottom. */
async function visibleTraceIds(page: import('@playwright/test').Page): Promise<string[]> {
  const ids = await page.locator('[data-testid^="trace-row-"]').evaluateAll(rows =>
    rows.map(r => r.getAttribute('data-testid') ?? ''),
  );
  return ids.map(id => id.replace('trace-row-', ''));
}

test.describe('Traces sorting + filter bar', () => {
  let endpointId: string;

  test.beforeAll(async ({ request }) => {
    const api = await makeClient(request);
    endpointId = await api.firstEndpointId();
  });

  test('clicking the Latency header sorts slowest-first, clicking again flips to fastest-first', async ({ page, request }) => {
    const client = await makeClient(request);
    const { id: agentId } = await client.createAgent({ name: uniqueName('Sort Agent'), endpointId });

    const slow = await client.seedAgentCall({ agentId, userContent: 'slow', assistantContent: 'r', durationMs: 5000 });
    const fast = await client.seedAgentCall({ agentId, userContent: 'fast', assistantContent: 'r', durationMs: 500 });
    const mid = await client.seedAgentCall({ agentId, userContent: 'mid', assistantContent: 'r', durationMs: 1500 });

    await page.goto('/traces', { waitUntil: 'load' });
    await expect(page.getByTestId('trace-table')).toBeVisible();
    await selectAgentFilter(page, agentId);
    await expect(page.getByTestId(`trace-row-${slow.id}`)).toBeVisible();

    // First click: descending (slowest first).
    await page.getByTestId('traces-sort-latency').click();
    await expect.poll(
      () => visibleTraceIds(page),
      { timeout: 10_000, message: 'rows should order slowest-first' },
    ).toEqual([slow.id, mid.id, fast.id]);

    // Second click on the active column: ascending (fastest first).
    await page.getByTestId('traces-sort-latency').click();
    await expect.poll(
      () => visibleTraceIds(page),
      { timeout: 10_000, message: 'rows should order fastest-first' },
    ).toEqual([fast.id, mid.id, slow.id]);
  });

  test('anomaly filter chip narrows to flagged traces and its editor removes it', async ({ page, request }) => {
    const client = await makeClient(request);
    const { id: agentId } = await client.createAgent({ name: uniqueName('Anomaly Agent'), endpointId });

    const flagged = await client.seedAgentCall({
      agentId, userContent: 'flagged', assistantContent: 'r', outlierFlags: HIGH_LATENCY,
    });
    const normal = await client.seedAgentCall({ agentId, userContent: 'normal', assistantContent: 'r' });

    await page.goto('/traces', { waitUntil: 'load' });
    await selectAgentFilter(page, agentId);
    await expect(page.getByTestId(`trace-row-${normal.id}`)).toBeVisible();

    await addTraceFilter(page, 'anomaly', 'highLatency');
    await expect(page.getByTestId(`trace-row-${flagged.id}`)).toBeVisible();
    await expect(page.getByTestId(`trace-row-${normal.id}`)).toHaveCount(0);

    // Removing the filter through the chip's editor restores the hidden row.
    await removeTraceFilter(page, 'anomaly');
    await expect(page.getByTestId(`trace-row-${normal.id}`)).toBeVisible();
    await expect(page.getByTestId(`trace-row-${flagged.id}`)).toBeVisible();
  });

  test('tool filter narrows to traces that requested the tool; Clear all restores everything', async ({ page, request }) => {
    const client = await makeClient(request);
    const { id: agentId } = await client.createAgent({ name: uniqueName('Tool Agent'), endpointId });

    const toolName = `e2e_tool_${Date.now()}`;
    const withTool = await client.seedAgentCall({
      agentId, userContent: 'with tool', assistantContent: 'r', toolNames: [toolName],
    });
    const withoutTool = await client.seedAgentCall({ agentId, userContent: 'no tool', assistantContent: 'r' });

    await page.goto('/traces', { waitUntil: 'load' });
    await selectAgentFilter(page, agentId);
    await expect(page.getByTestId(`trace-row-${withoutTool.id}`)).toBeVisible();

    await addTraceFilter(page, 'tool', toolName);
    await expect(page.getByTestId(`trace-row-${withTool.id}`)).toBeVisible();
    await expect(page.getByTestId(`trace-row-${withoutTool.id}`)).toHaveCount(0);

    // "Clear all" drops every chip (tool + agent) — both traces come back.
    await page.getByTestId('traces-clear-filters').click();
    await expect(page.getByTestId(`trace-row-${withTool.id}`)).toBeVisible();
    await expect(page.getByTestId(`trace-row-${withoutTool.id}`)).toBeVisible();
  });

  test('the tool filter only offers tools the selected agent actually used', async ({ page, request }) => {
    const client = await makeClient(request);
    const agentA = await client.createAgent({ name: uniqueName('Tool Scope A'), endpointId });
    const agentB = await client.createAgent({ name: uniqueName('Tool Scope B'), endpointId });
    const toolA = `e2e_tool_a_${Date.now()}`;
    const toolB = `e2e_tool_b_${Date.now()}`;
    await client.seedAgentCall({ agentId: agentA.id, userContent: 'a', assistantContent: 'r', toolNames: [toolA] });
    await client.seedAgentCall({ agentId: agentB.id, userContent: 'b', assistantContent: 'r', toolNames: [toolB] });

    await page.goto('/traces', { waitUntil: 'load' });
    await selectAgentFilter(page, agentA.id);
    await expect(page.getByTestId('traces-filter-chip-agent')).toBeVisible();

    // With agent A selected, the tool picker lists only agent A's tool — not agent B's.
    await page.getByTestId('traces-add-filter').click();
    await page.getByTestId('traces-filter-field-tool').click();
    await expect(page.getByTestId(`traces-filter-option-${toolA}`)).toBeVisible();
    await expect(page.getByTestId(`traces-filter-option-${toolB}`)).toHaveCount(0);
  });

  test('System traces is toggled on from + Filter as a chip; Clear all removes it', async ({ page, request }) => {
    const client = await makeClient(request);
    const { id: agentId } = await client.createAgent({ name: uniqueName('System Filter Agent'), endpointId });
    await client.seedAgentCall({ agentId, userContent: 'hello', assistantContent: 'r' });

    await page.goto('/traces', { waitUntil: 'load' });
    await selectAgentFilter(page, agentId);
    await expect(page.getByTestId('traces-filter-chip-agent')).toBeVisible();

    // System traces lives in the same "+ Filter" picker as the value filters and, once on,
    // surfaces as its own removable chip (no standalone toolbar toggle any more).
    await toggleSystemTraces(page);
    await expect(page.getByTestId('traces-filter-chip-system')).toBeVisible();

    // "Clear all" drops every chip, including System traces.
    await page.getByTestId('traces-clear-filters').click();
    await expect(page.getByTestId('traces-filter-chip-system')).toHaveCount(0);
    await expect(page.getByTestId('traces-filter-chip-agent')).toHaveCount(0);
  });
});
