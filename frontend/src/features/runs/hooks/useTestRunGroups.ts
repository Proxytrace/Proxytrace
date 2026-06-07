import { useQuery } from '@tanstack/react-query';
import { testRunGroupsApi } from '../../../api/test-run-groups';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';

/**
 * Group list for the current project (optionally filtered by agent). Live runs update via the
 * group SSE stream (see {@link useRunGroupStream}), which patches this cache in place — there is
 * no polling here (BEST_PRACTICES §3.2: SSE patches, never refetch on an interval).
 */
export function useTestRunGroups(agentFilter: string, includeSystem = false) {
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;

  const query = useQuery({
    queryKey: QUERY_KEYS.testRunGroups(agentFilter, projectId, includeSystem),
    queryFn: () => testRunGroupsApi.list({
      agentId: agentFilter || undefined,
      projectId: agentFilter ? undefined : projectId,
      includeSystem: includeSystem || undefined,
      pageSize: 100,
    }),
    enabled: currentProjectId !== null,
  });

  return { groups: query.data?.items ?? [], isLoading: query.isLoading };
}
