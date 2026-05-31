import { useQueryClient, useMutation } from '@tanstack/react-query';
import { testSuitesApi } from '../../../api/test-suites';

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
      // Invalidate the whole test-suites namespace via the bare root; testSuites() ends in `null`,
      // which fails to prefix-match a list keyed by an actual projectId.
      qc.invalidateQueries({ queryKey: ['test-suites'] });
      onSuccess();
    },
  });
}
