import { useQuery } from '@tanstack/react-query';
import { testRunGroupsApi } from '../../../api/test-run-groups';
import { QUERY_KEYS } from '../../../api/query-keys';

const HISTORY_PAGE_SIZE = 100;

/**
 * Run history for a single suite (newest first), backing the suite detail's **History** tab. Reads
 * the suite-scoped `GET /api/test-run-groups?suiteId=` endpoint — so it is not diluted by other
 * suites on the same agent. A/B (system) runs are excluded, matching the Runs page default. The
 * group SSE stream patches the shared {@link QUERY_KEYS.testRunGroupsRoot} cache, so a completing
 * run shows up here without a refetch.
 */
export function useSuiteRunGroups(suiteId: string) {
  const query = useQuery({
    queryKey: QUERY_KEYS.testRunGroupsBySuite(suiteId),
    queryFn: () => testRunGroupsApi.list({ suiteId, pageSize: HISTORY_PAGE_SIZE }),
    enabled: !!suiteId,
  });

  return {
    groups: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
  };
}
