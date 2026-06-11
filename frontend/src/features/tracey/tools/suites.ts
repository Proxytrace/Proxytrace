import { z } from 'zod';
import { testSuitesApi } from '../../../api/test-suites';
import { type ToolFactory, tool, empty, ignore404, listDigest } from './shared';

export const createSuiteTools: ToolFactory = (ctx, store) => {
  const projectId = ctx.projectId;
  return {
    list_suites: tool({
      description:
        'List the test suites in the current project. Returns a compact index (id + name) plus a ' +
        'reference; the full list is rendered to the user. To inspect one suite, call get_suite.',
      parameters: empty,
      confirm: false,
      execute: async () => {
        const items = (await testSuitesApi.list({ projectId })).items;
        return store('suite-list', items, listDigest(items, 25, (s) => ({ id: s.id, name: s.name })));
      },
    }),
    get_suite: tool({
      description:
        'Get a single test suite by id. Returns a curated summary (name, case count, pass rate) ' +
        'plus a reference; the full suite is rendered to the user as a card.',
      parameters: z.object({ suiteId: z.string().describe('The id of the test suite to fetch.') }),
      confirm: false,
      execute: async ({ suiteId }) => {
        const suite = await ignore404(() => testSuitesApi.get(suiteId, { silentStatuses: [404] }));
        if (!suite) return { notFound: suiteId };
        return store('suite', suite, {
          id: suite.id,
          name: suite.name,
          caseCount: suite.testCases.length,
          passRate: suite.passRate,
        });
      },
    }),
  };
};
