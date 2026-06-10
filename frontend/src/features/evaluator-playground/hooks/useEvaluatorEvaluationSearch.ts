import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { evaluatorTestBenchApi } from '../../../api/evaluator-testbench';
import { QUERY_KEYS } from '../../../api/query-keys';
import type { PastEvaluation } from './useRecentEvaluations';

const SEARCH_COUNT = 25;
export const MIN_QUERY = 2;

/**
 * Searches the selected evaluator's own past evaluations (by test-case summary or the
 * evaluator's reasoning) — scoped to the evaluator, unlike the project-wide entity search.
 * Below the minimum query length the query is disabled; callers fall back to the recent list.
 */
export function useEvaluatorEvaluationSearch(evaluatorId: string, query: string) {
  const trimmed = query.trim();
  const enabled = evaluatorId.length > 0 && trimmed.length >= MIN_QUERY;

  const q = useQuery({
    queryKey: QUERY_KEYS.evaluatorTestBenchSearch(evaluatorId, trimmed, SEARCH_COUNT),
    queryFn: () => evaluatorTestBenchApi.search(evaluatorId, trimmed, SEARCH_COUNT),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const results: PastEvaluation[] = (q.data ?? []).map(r => ({
    testCaseId: r.testCaseId,
    label: r.label,
    score: r.score,
  }));

  return { results, isFetching: enabled && q.isFetching, active: enabled };
}
