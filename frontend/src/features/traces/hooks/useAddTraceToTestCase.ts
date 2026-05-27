import { useMutation, useQueryClient } from '@tanstack/react-query';
import { testSuitesApi } from '../../../api/test-suites';
import { QUERY_KEYS } from '../../../api/query-keys';

interface UseAddTraceToTestCaseArgs {
  suiteId: string;
  traceId: string;
  onSuccess?: (suiteName: string) => void;
}

/**
 * Mutation that adds a captured trace as a test case to the given suite.
 * Invalidates the test-suites root key so every suite list / detail refetches.
 */
export function useAddTraceToTestCase({ suiteId, traceId, onSuccess }: UseAddTraceToTestCaseArgs) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => testSuitesApi.addTestCase(suiteId, traceId),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.testSuitesRoot });
      onSuccess?.(updated.name);
    },
    onError: (err) => {
      console.error(err);
    },
  });
}
