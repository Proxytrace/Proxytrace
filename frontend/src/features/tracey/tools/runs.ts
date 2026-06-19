import { z } from 'zod';
import { agentsApi } from '../../../api/agents';
import { testSuitesApi } from '../../../api/test-suites';
import { testRunsApi } from '../../../api/test-runs';
import { testRunGroupsApi } from '../../../api/test-run-groups';
import { type ToolFactory, tool, CANCELLED, ignore404, isEntityId, listDigest } from './shared';
import { clip, compareRuns, failingResults } from './run-analysis';
import { isRunTerminal } from './await';

export const createRunTools: ToolFactory = (_ctx, store) => ({
  list_runs: tool({
    description:
      'List recent test runs, newest first. Pass agentId to list only that agent\'s runs (use this ' +
      'when optimizing or inspecting one agent); omit it for the whole project. Returns a compact ' +
      'index (id, suite, agent, status, pass rate) plus a reference; the full list is rendered to ' +
      'the user. To inspect one run, call get_run.',
    parameters: z.object({
      agentId: z.string().optional().describe('Restrict to the runs of this agent (an id from list_agents).'),
    }),
    confirm: false,
    execute: async ({ agentId }) => {
      if (agentId !== undefined && !isEntityId(agentId)) return { notFound: agentId };
      const items = (await testRunsApi.list({ agentId })).items;
      return store('run-list', items, listDigest(items, 20, (r) => ({
        id: r.id, suiteName: r.suiteName, agentName: r.agentName, status: r.status, passRate: r.passRate,
      })));
    },
  }),
  get_run: tool({
    description:
      'Get a single test run by id. Returns a curated summary (suite, agent, status, pass/fail ' +
      'counts) plus a reference; the full run is rendered to the user as a card.',
    parameters: z.object({ runId: z.string().describe('The id of the test run to fetch.') }),
    confirm: false,
    execute: async ({ runId }) => {
      const run = await ignore404(() => testRunsApi.get(runId, { silentStatuses: [404] }));
      if (!run) return { notFound: runId };
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
  get_run_failures: tool({
    description:
      "Get a run's FAILING test cases with each case's actual response and per-evaluator " +
      'verdicts (score + reasoning). This is the primary evidence tool for tuning: read it ' +
      'before forming a hypothesis about why an agent fails. The failing cases are rendered to ' +
      'the user as a card.',
    parameters: z.object({
      runId: z.string().describe('The id of the test run to analyze.'),
      limit: z.number().int().min(1).max(20).optional()
        .describe('Max failing cases in the digest (default 8); the card always shows all of them.'),
    }),
    confirm: false,
    execute: async ({ runId, limit }) => {
      const run = await ignore404(() => testRunsApi.get(runId, { silentStatuses: [404] }));
      if (!run) return { notFound: runId };
      const failures = failingResults(run);
      return store('run-failures', {
        runId: run.id,
        suiteName: run.suiteName,
        agentName: run.agentName,
        passRate: run.passRate,
        totalCases: run.totalCases,
        failures,
      }, {
        runId: run.id,
        suiteName: run.suiteName,
        agentName: run.agentName,
        passRate: run.passRate,
        failedCases: failures.length,
        totalCases: run.totalCases,
        failures: failures.slice(0, limit ?? 8).map((r) => ({
          case: clip(r.testCaseSummary, 160),
          actual: clip(r.actualResponse, 280),
          evaluations: r.evaluations.map((e) => ({
            evaluator: e.evaluatorName,
            score: e.score,
            reasoning: e.reasoning ? clip(e.reasoning, 200) : null,
            ...(e.errorMessage ? { error: clip(e.errorMessage, 120) } : {}),
          })),
        })),
      });
    },
  }),
  compare_runs: tool({
    description:
      'Compare two test runs of the same suite case by case: which cases a change fixed, which ' +
      'it regressed, and which are unchanged. Use it to judge a before/after (e.g. an older run ' +
      'vs the latest, or two agents on one suite). Pass the older/baseline run first. The ' +
      'comparison is rendered to the user as a card.',
    parameters: z.object({
      baselineRunId: z.string().describe('The id of the baseline (earlier) run.'),
      candidateRunId: z.string().describe('The id of the candidate (later) run to compare against it.'),
    }),
    confirm: false,
    execute: async ({ baselineRunId, candidateRunId }) => {
      const [baseline, candidate] = await Promise.all([
        ignore404(() => testRunsApi.get(baselineRunId, { silentStatuses: [404] })),
        ignore404(() => testRunsApi.get(candidateRunId, { silentStatuses: [404] })),
      ]);
      const missing = [
        ...(baseline ? [] : [baselineRunId]),
        ...(candidate ? [] : [candidateRunId]),
      ];
      if (!baseline || !candidate) return { notFound: missing };
      const comparison = compareRuns(baseline, candidate);
      const summaries = (movement: 'fixed' | 'regressed') =>
        comparison.cases
          .filter((c) => c.movement === movement)
          .slice(0, 10)
          .map((c) => clip(c.summary, 120));
      return store('run-comparison', comparison, {
        suiteName: comparison.suiteName,
        baseline: comparison.baseline,
        candidate: comparison.candidate,
        fixed: comparison.fixed,
        regressed: comparison.regressed,
        stillFailing: comparison.stillFailing,
        stillPassing: comparison.stillPassing,
        unmatched: comparison.unmatched,
        fixedCases: summaries('fixed'),
        regressedCases: summaries('regressed'),
      });
    },
  }),
  start_test_run: tool({
    description:
      'Start a test run of a suite against an agent. Requires confirmation. Returns a compact ' +
      'summary plus an `awaitable` handle (do not poll for progress — a live card streams it); ' +
      'your next step must pass the handle to await_actions (the app enforces this).',
    parameters: z.object({
      suiteId: z.string().describe('The id of the test suite to run.'),
      agentId: z.string().describe('The id of the agent to run the suite against.'),
    }),
    confirm: true,
    execute: async ({ suiteId, agentId }, c) => {
      const agent = await ignore404(() => agentsApi.get(agentId, { silentStatuses: [404] }));
      if (!agent) return { notFound: agentId };
      const suite = await ignore404(() => testSuitesApi.get(suiteId, { silentStatuses: [404] }));
      if (!suite) return { notFound: suiteId };
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
  cancel_test_run: tool({
    description:
      'Cancel an in-progress test run. Requires confirmation. Pass the test-run group id (the ' +
      '`awaitable` id from start_test_run, or a group id from list_runs / get_run).',
    parameters: z.object({
      groupId: z.string().describe('The id of the test-run group to cancel (the start_test_run awaitable id).'),
    }),
    confirm: true,
    execute: async ({ groupId }, c) => {
      const group = await ignore404(() => testRunGroupsApi.get(groupId, { silentStatuses: [404] }));
      if (!group) return { notFound: groupId };
      // A finished run can't be cancelled; short-circuit so we don't hit the backend (which would
      // reject) and can tell the model it's already done rather than surface an error.
      if (isRunTerminal(group.status)) return { id: group.id, status: group.status, alreadyTerminal: true };
      const ok = await c.confirm(`Cancel the run of suite "${group.suiteName}" against "${group.agentName}"?`);
      if (!ok) return CANCELLED;
      const cancelled = await testRunGroupsApi.cancel(groupId);
      return { id: cancelled.id, status: cancelled.status };
    },
  }),
});
