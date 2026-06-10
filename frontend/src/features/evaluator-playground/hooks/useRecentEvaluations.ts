import { useQuery } from '@tanstack/react-query';
import { evaluatorTestBenchApi } from '../../../api/evaluator-testbench';
import { QUERY_KEYS } from '../../../api/query-keys';
import type { EvaluationScore } from '../../../api/models';

const RECENT_COUNT = 10;

/** A pickable past evaluation: a test case this evaluator has scored, with its logged score. */
export interface PastEvaluation {
  testCaseId: string;
  label: string;
  score: EvaluationScore | null;
}

/**
 * The evaluator's most recent scored cases for the rail (capped at 10). Reaching
 * past the recent set is the search box's job — it reuses the shared
 * `UnifiedSearch` component scoped to test cases.
 */
export function useRecentEvaluations(evaluatorId: string) {
  const query = useQuery({
    queryKey: QUERY_KEYS.evaluatorTestBenchRecent(evaluatorId, RECENT_COUNT),
    queryFn: () => evaluatorTestBenchApi.recent(evaluatorId, RECENT_COUNT),
    enabled: evaluatorId.length > 0,
    staleTime: 30_000,
  });

  return {
    items: (query.data ?? []).map(r => ({ testCaseId: r.testCaseId, label: r.label, score: r.score })),
    isLoading: query.isLoading,
  };
}
