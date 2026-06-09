import { test, expect } from '../helpers/fixtures';
import type { APIRequestContext } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';

// Per-token COST coverage.
//
// Goal: verify the per-token pricing set on a model endpoint flows all the way through to the
// UI as a computed, non-zero cost on a captured trace.
//
// Cost model (see Proxytrace.Domain ModelEndpoint.CalculateCost): pricing is expressed PER
// MILLION tokens —
//   cost = (inputTokenCost * inputTokens + outputTokenCost * outputTokens) / 1_000_000
// and is only non-null when BOTH input and output token costs are set. The AgentCall DTO mapper
// derives `costEur` via `endpoint.CalculateCost(usage)` (Proxytrace.Api AgentCallDtoMapper), so
// the cost depends on the AGENT'S endpoint pricing — not on the seeded `model` string.
//
// The Traces metadata tab renders `cost_eur` with `.toFixed(6)`, so the pricing must produce a
// cost >= 0.000001 to be visible. The task's example costs (0.000001 / 0.000002) divided by a
// million round to "0.000000"; we therefore use realistic per-million pricing (EUR 5 / EUR 15
// per 1M tokens) with several thousand tokens so the displayed cost is unambiguously non-zero.
//
// Dashboard: the dashboard feature (frontend/src/features/dashboard/**) surfaces traces, tokens,
// latency, pass-rate and a live trace stream — but NO cost tile/section. (The statistics API does
// expose a /api/statistics/cost-estimate endpoint, but the dashboard UI does not consume it.) The
// dashboard half is therefore documented as a gap and not asserted; see the report.

const INPUT_TOKEN_COST = 5; // EUR per 1M input tokens
const OUTPUT_TOKEN_COST = 15; // EUR per 1M output tokens
const INPUT_TOKENS = 10_000;
const OUTPUT_TOKENS = 5_000;
// (5 * 10000 + 15 * 5000) / 1_000_000 = 125000 / 1_000_000 = 0.125 EUR
const EXPECTED_COST = (INPUT_TOKEN_COST * INPUT_TOKENS + OUTPUT_TOKEN_COST * OUTPUT_TOKENS) / 1_000_000;

function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function makeClient(request: APIRequestContext): Promise<ProxytraceApiClient> {
  const client = new ProxytraceApiClient(request);
  const { token } = await client.login('admin@e2e.test', 'E2ePassword1!');
  client.setToken(token);
  return client;
}

test.describe('Cost', () => {
  let providerId: string;
  let endpointId: string;

  test.beforeAll(async ({ request }) => {
    const api = await makeClient(request);

    // Dedicated provider + model endpoint so pricing is isolated from the setup default endpoint
    // (which other specs attach to and which carries no pricing).
    const provider = await api.createProvider({
      name: uniqueName('Cost Provider'),
      endpoint: 'https://api.openai.com/v1',
      upstreamApiKey: 'sk-e2e-cost-not-used',
      kind: 'OpenAi',
    });
    providerId = provider.id;

    const model = await api.addModelToProvider(providerId, uniqueName('cost-model'));
    endpointId = model.id;

    // Set non-zero per-million pricing on the endpoint.
    const priced = await api.updateModelPricing(providerId, endpointId, INPUT_TOKEN_COST, OUTPUT_TOKEN_COST);
    expect(priced.inputTokenCost).toBe(INPUT_TOKEN_COST);
    expect(priced.outputTokenCost).toBe(OUTPUT_TOKEN_COST);

    // Confirm the pricing landed on the endpoint as read back from the model-endpoints list.
    const endpoints = await api.getModelEndpoints();
    const ours = endpoints.find((e) => e.id === endpointId);
    expect(ours, 'priced endpoint should be present in /api/model-endpoints').toBeTruthy();
    expect(ours?.inputTokenCost).toBe(INPUT_TOKEN_COST);
    expect(ours?.outputTokenCost).toBe(OUTPUT_TOKEN_COST);
  });

  test('backend derives a non-zero costEur from endpoint pricing', async ({ request }) => {
    // Pure-API guard: proves the mapper computes cost from pricing before we assert the UI. If
    // this fails, the UI assertions below can't possibly pass.
    const client = await makeClient(request);

    const { id: agentId } = await client.createAgent({ name: uniqueName('Cost API Agent'), endpointId });
    const { id: callId } = await client.seedAgentCall({
      agentId,
      userContent: 'cost api probe',
      assistantContent: 'priced reply',
      inputTokens: INPUT_TOKENS,
      outputTokens: OUTPUT_TOKENS,
    });

    // Locate the seeded call in the agent-calls feed and assert its costEur matches the formula.
    await expect
      .poll(
        async () => {
          const { items } = await client.getAgentCalls({ page: 1, pageSize: 100 });
          const row = items.find((i) => (i as { id?: string }).id === callId) as { costEur?: number } | undefined;
          return row?.costEur ?? null;
        },
        { timeout: 10_000, message: 'seeded call did not expose a costEur' },
      )
      .toBeCloseTo(EXPECTED_COST, 6);
  });

  test('Traces detail metadata tab shows a non-zero cost for a priced trace', async ({ page, request }) => {
    const client = await makeClient(request);

    const { id: agentId } = await client.createAgent({ name: uniqueName('Cost UI Agent'), endpointId });
    const userText = `cost ui probe ${Date.now()}`;
    const call = await client.seedAgentCall({
      agentId,
      userContent: userText,
      assistantContent: 'priced ui reply',
      inputTokens: INPUT_TOKENS,
      outputTokens: OUTPUT_TOKENS,
    });

    await page.goto('/traces', { waitUntil: 'load' });
    await expect(page.getByTestId('trace-table')).toBeVisible();

    // Narrow to this agent (via the toolbar Agent filter) so the row is deterministic.
    await page.getByTestId('traces-agent-filter').click();
    await page.getByTestId(`traces-agent-filter-option-${agentId}`).click();

    // Open the detail drawer and switch to the Metadata tab where cost_eur is rendered.
    await page.getByTestId(`trace-row-${call.id}`).click();
    await expect(page.getByTestId('trace-detail')).toBeVisible();

    await page.getByTestId('trace-tab-metadata').click();
    await expect(page.getByTestId('trace-metadata-tab')).toBeVisible();

    // The cost value carries a stable `trace-metadata-cost` testid (TraceMetadataTab). It is
    // rendered with .toFixed(6), so a non-zero cost reads as a positive 6-decimal number, never
    // "0.000000" or the "—" placeholder.
    const costCell = page.getByTestId('trace-metadata-cost');
    await expect(costCell).toBeVisible();
    await expect(costCell).not.toHaveText('—');
    await expect(costCell).not.toHaveText('0.000000');
    await expect
      .poll(async () => Number((await costCell.textContent())?.trim() ?? '0'))
      .toBeGreaterThan(0);
    // It should match the computed cost (0.125 EUR) to 6 decimals.
    await expect(costCell).toHaveText(EXPECTED_COST.toFixed(6));
  });
});
