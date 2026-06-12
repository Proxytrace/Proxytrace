import { useQuery } from '@tanstack/react-query';
import { evaluatorTestBenchApi } from '../../../api/evaluator-testbench';
import { QUERY_KEYS } from '../../../api/query-keys';

/** One logged evaluation (verdict + test case) for the search-result preview. */
export function usePastEvaluation(evaluatorId: string, caseId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.evaluatorTestBench(evaluatorId, caseId ?? ''),
    queryFn: () => evaluatorTestBenchApi.load(evaluatorId, caseId ?? ''),
    enabled: evaluatorId.length > 0 && caseId != null,
    staleTime: 60_000,
    retry: false,
  });
}
