import { useQuery } from '@tanstack/react-query';
import { testRunGroupsApi } from '../../../api/test-run-groups';
import { QUERY_KEYS } from '../../../api/query-keys';

/**
 * Full (fat) test-run group for the selected list item — nested per-case results, test cases and
 * evaluations the matrix/heatmap render. The list itself only carries light {@link TestRunSummaryDto}
 * rows; the heavy graph is fetched once per selection here. Keyed by the shared single-group key so
 * the live SSE stream ({@link useRunGroupStream}) patches this same cache in place — never refetching
 * mid-run (BEST_PRACTICES §3.2). Tracey's run card warms the same key, so a just-started run is hot.
 */
export function useTestRunGroupDetail(groupId: string | null) {
  const query = useQuery({
    queryKey: QUERY_KEYS.testRunGroup(groupId ?? ''),
    queryFn: () => testRunGroupsApi.get(groupId ?? ''),
    enabled: !!groupId,
  });

  return { group: query.data, isLoading: query.isLoading };
}
