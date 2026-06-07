import { useQuery } from '@tanstack/react-query';
import { testRunGroupsApi } from '../../../api/test-run-groups';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';
import { REFETCH_INTERVAL_LIVE } from '../../../lib/constants';
import { isActive } from '../results';

/** Group list for the current project (optionally filtered by agent). Polls only while a run is active. */
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
    refetchInterval: q => {
      const items = q.state.data?.items ?? [];
      return items.some(g => g.runs.some(r => isActive(r.status))) ? REFETCH_INTERVAL_LIVE : false;
    },
    enabled: currentProjectId !== null,
  });

  return { groups: query.data?.items ?? [], isLoading: query.isLoading };
}
