import { z } from 'zod';
import { agentsApi } from '../../../api/agents';
import { testSuitesApi } from '../../../api/test-suites';
import { testCasesApi } from '../../../api/test-cases';
import { type ToolFactory, tool, CANCELLED, ignore404, isEntityId, listDigest, presentArg } from './shared';

/** The compact suite digest returned by the read + curation tools (the card shows everything). */
const suiteDigest = (suite: { id: string; name: string; agentName: string; testCases: unknown[]; passRate: number | null }) => ({
  id: suite.id,
  name: suite.name,
  agentName: suite.agentName,
  caseCount: suite.testCases.length,
  passRate: suite.passRate,
});

export const createSuiteTools: ToolFactory = (ctx, store) => {
  const projectId = ctx.projectId;
  return {
    list_suites: tool({
      description:
        'List test suites. Pass agentId to list only the suites that benchmark that agent (use this when ' +
        'optimizing or curating for a specific agent); omit it for all of the project\'s suites. Returns a ' +
        'compact index — each row carries the suite\'s agent — and the full list renders to the user.',
      parameters: z.object({
        present: presentArg,
        agentId: z.string().optional().describe('Restrict to the suites that benchmark this agent.'),
      }),
      confirm: false,
      execute: async ({ agentId }) => {
        if (agentId !== undefined && !isEntityId(agentId)) return { notFound: agentId };
        const items = (await testSuitesApi.list({ projectId, agentId })).items;
        return store(
          'suite-list',
          items,
          listDigest(items, 25, (s) => ({ id: s.id, name: s.name, agentId: s.agentId, agentName: s.agentName })),
        );
      },
    }),
    get_suite: tool({
      description:
        'Get one test suite by id. Returns a summary (name, case count, pass rate); the full suite ' +
        'renders as a card. Each test case carries its own id — use those with remove_test_case / update_expected_output.',
      parameters: z.object({ present: presentArg, suiteId: z.string().describe('The id of the test suite to fetch.') }),
      confirm: false,
      execute: async ({ suiteId }) => {
        const suite = await ignore404(() => testSuitesApi.get(suiteId, { silentStatuses: [404] }));
        if (!suite) return { notFound: suiteId };
        return store('suite', suite, suiteDigest(suite));
      },
    }),
    create_suite: tool({
      description:
        'Create a benchmark suite for an agent, seeded from captured traces. Requires confirmation. ' +
        '`agentCallIds` are trace ids from find_traces; each becomes a test case. Returns the new suite as a card.',
      parameters: z.object({
        name: z.string().min(1).describe('A short, descriptive name for the suite.'),
        agentId: z.string().describe('The id of the agent the suite benchmarks.'),
        agentCallIds: z.array(z.string()).min(1)
          .describe('Captured trace (agent-call) ids to seed as test cases — from find_traces.'),
      }),
      confirm: true,
      execute: async ({ name, agentId, agentCallIds }, c) => {
        const agent = await ignore404(() => agentsApi.get(agentId, { silentStatuses: [404] }));
        if (!agent) return { notFound: agentId };
        const n = agentCallIds.length;
        const ok = await c.confirm(`Create suite "${name}" for agent "${agent.name}" from ${n} trace${n === 1 ? '' : 's'}?`);
        if (!ok) return CANCELLED;
        const suite = await testSuitesApi.create({ name, agentId, agentCallIds });
        return store('suite', suite, suiteDigest(suite));
      },
    }),
    add_to_suite: tool({
      description:
        'Add captured traces to an existing suite as new test cases. Requires confirmation. ' +
        '`agentCallIds` are trace ids from find_traces. Returns the updated suite as a card.',
      parameters: z.object({
        suiteId: z.string().describe('The id of the suite to add cases to.'),
        agentCallIds: z.array(z.string()).min(1)
          .describe('Captured trace (agent-call) ids to add as test cases — from find_traces.'),
      }),
      confirm: true,
      execute: async ({ suiteId, agentCallIds }, c) => {
        const existing = await ignore404(() => testSuitesApi.get(suiteId, { silentStatuses: [404] }));
        if (!existing) return { notFound: suiteId };
        const n = agentCallIds.length;
        const ok = await c.confirm(`Add ${n} case${n === 1 ? '' : 's'} to suite "${existing.name}"?`);
        if (!ok) return CANCELLED;
        // Each addTestCase commits server-side and returns the whole updated suite. Apply
        // sequentially; capture per-id failures rather than throwing, so a mid-batch error
        // (e.g. one stale trace id) can't both partially mutate the suite AND lose the report of
        // what was added. Keep the latest successful suite snapshot for the digest/card.
        let suite = existing;
        const failed: { id: string; error: string }[] = [];
        for (const id of agentCallIds) {
          try {
            suite = await testSuitesApi.addTestCase(suiteId, id);
          } catch (e) {
            failed.push({ id, error: e instanceof Error ? e.message : String(e) });
          }
        }
        return store('suite', suite, { ...suiteDigest(suite), ...(failed.length > 0 ? { failed } : {}) });
      },
    }),
    remove_test_case: tool({
      description:
        'Remove a test case from a suite. Requires confirmation. Pass the suite id and the case id ' +
        '(from get_suite). Returns the updated suite as a card.',
      parameters: z.object({
        suiteId: z.string().describe('The id of the suite.'),
        caseId: z.string().describe('The id of the test case to remove (from get_suite).'),
      }),
      confirm: true,
      execute: async ({ suiteId, caseId }, c) => {
        const existing = await ignore404(() => testSuitesApi.get(suiteId, { silentStatuses: [404] }));
        if (!existing) return { notFound: suiteId };
        const ok = await c.confirm(`Remove a test case from suite "${existing.name}"?`);
        if (!ok) return CANCELLED;
        const suite = await testSuitesApi.removeTestCase(suiteId, caseId);
        return store('suite', suite, suiteDigest(suite));
      },
    }),
    update_expected_output: tool({
      description:
        "Set a test case's expected output — what it is scored against. Requires confirmation. " +
        'Pass the case id (from get_suite) and the expected assistant text.',
      parameters: z.object({
        caseId: z.string().describe('The id of the test case to update (from get_suite).'),
        content: z.string().min(1).describe('The expected assistant response the case is scored against.'),
      }),
      confirm: true,
      execute: async ({ caseId, content }, c) => {
        const ok = await c.confirm('Update the expected output of this test case?');
        if (!ok) return CANCELLED;
        const updated = await ignore404(() =>
          testCasesApi.update(caseId, { role: 'assistant', content }, { silentStatuses: [404] }),
        );
        if (!updated) return { notFound: caseId };
        return { caseId: updated.id, status: 'updated' };
      },
    }),
  };
};
