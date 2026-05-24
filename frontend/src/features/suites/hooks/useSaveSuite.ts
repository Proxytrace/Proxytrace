import { useQueryClient, useMutation } from '@tanstack/react-query';
import { testSuitesApi } from '../../../api/test-suites';
import { QUERY_KEYS } from '../../../api/query-keys';

interface SaveArgs {
  suiteId: string;
  pendingAddTraceIds: Set<string>;
  pendingRemoveCaseIds: Set<string>;
  stagedEvaluatorIds: Set<string>;
  evaluatorsChanged: boolean;
}

/** Mutation to save pending changes (add/remove cases, update evaluators) to a suite. */
export function useSaveSuite(onSuccess: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ suiteId, pendingAddTraceIds, pendingRemoveCaseIds, stagedEvaluatorIds, evaluatorsChanged }: SaveArgs) => {
      for (const traceId of pendingAddTraceIds) {
        await testSuitesApi.addTestCase(suiteId, traceId);
      }
      for (const caseId of pendingRemoveCaseIds) {
        await testSuitesApi.removeTestCase(suiteId, caseId);
      }
      if (evaluatorsChanged) {
        await testSuitesApi.updateEvaluators(suiteId, [...stagedEvaluatorIds]);
      }
    },
    onSuccess: () => {
      // Invalidate all test-suites queries (prefix match)
      qc.invalidateQueries({ queryKey: QUERY_KEYS.testSuites() });
      onSuccess();
    },
  });
}
