import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { testSuitesApi } from '../../../api/test-suites';
import { QUERY_KEYS } from '../../../api/query-keys';
import type { TestSuiteMessageDto } from '../../../api/models';

const SUITE_PICKER_PAGE_SIZE = 200;

/** Suites owned by the trace's agent — promotion targets for the detail panel / promote modal. */
export function useAgentSuites(agentId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.testSuites(agentId ?? undefined),
    queryFn: () => testSuitesApi.list({ agentId: agentId ?? undefined, pageSize: SUITE_PICKER_PAGE_SIZE }),
    enabled: !!agentId,
  });
}

interface PromoteArgs {
  suiteId: string;
  traceId: string;
  expected: TestSuiteMessageDto;
}

/** Adds a trace to a suite as a test case; refreshes the suites namespace, then runs `onDone(name)`. */
export function usePromoteTrace(onDone: (suiteName: string) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ suiteId, traceId, expected }: PromoteArgs) =>
      testSuitesApi.addTestCase(suiteId, traceId, expected),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.testSuitesRoot });
      onDone(updated.name);
    },
  });
}
