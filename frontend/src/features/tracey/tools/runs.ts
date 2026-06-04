import { z } from 'zod';
import { agentsApi } from '../../../api/agents';
import { testSuitesApi } from '../../../api/test-suites';
import { testRunsApi } from '../../../api/test-runs';
import { testRunGroupsApi } from '../../../api/test-run-groups';
import { type ToolFactory, tool, empty, CANCELLED } from './shared';

export const createRunTools: ToolFactory = (_ctx, store) => ({
  list_runs: tool({
    description:
      'List recent test runs. Returns a compact index (id, suite, agent, status, pass rate) plus ' +
      'a reference; the full list is rendered to the user. To inspect one run, call get_run.',
    parameters: empty,
    confirm: false,
    execute: async () => {
      const items = (await testRunsApi.list({})).items;
      return store('run-list', items, {
        count: items.length,
        items: items.map((r) => ({
          id: r.id, suiteName: r.suiteName, agentName: r.agentName, status: r.status, passRate: r.passRate,
        })),
      });
    },
  }),
  get_run: tool({
    description:
      'Get a single test run by id. Returns a curated summary (suite, agent, status, pass/fail ' +
      'counts) plus a reference; the full run is rendered to the user as a card.',
    parameters: z.object({ runId: z.string().describe('The id of the test run to fetch.') }),
    confirm: false,
    execute: async ({ runId }) => {
      const run = await testRunsApi.get(runId);
      return store('run', run, {
        id: run.id,
        suiteName: run.suiteName,
        agentName: run.agentName,
        status: run.status,
        passRate: run.passRate,
        passedCases: run.passedCases,
        failedCases: run.failedCases,
        totalCases: run.totalCases,
      });
    },
  }),
  start_test_run: tool({
    description:
      'Start a test run of a suite against an agent. Requires user confirmation. On start the ' +
      'user sees a live progress card that streams completion + pass/fail as cases finish; you ' +
      'get back only a compact summary (group id, status, case count) — do not poll for progress.',
    parameters: z.object({
      suiteId: z.string().describe('The id of the test suite to run.'),
      agentId: z.string().describe('The id of the agent to run the suite against.'),
    }),
    confirm: true,
    execute: async ({ suiteId, agentId }, c) => {
      const agent = await agentsApi.get(agentId);
      const suite = await testSuitesApi.get(suiteId);
      const ok = await c.confirm(`Run suite "${suite.name}" against agent "${agent.name}" (${agent.endpointName})?`);
      if (!ok) return CANCELLED;
      const group = await testRunGroupsApi.create(suiteId, [agent.endpointId]);
      return store('test-run-group', group, {
        id: group.id,
        suiteName: group.suiteName,
        agentName: group.agentName,
        status: group.status,
        totalCases: group.runs.reduce((sum, run) => sum + run.totalCases, 0),
        awaitable: { kind: 'test-run', id: group.id },
      });
    },
  }),
});
