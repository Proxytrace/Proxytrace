import { useQuery } from '@tanstack/react-query';
import { testRunSchedulesApi } from '../../../api/test-run-schedules';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';

/**
 * Test-run schedules for the current project (optionally filtered by agent). Summaries refresh when
 * a run finishes via the group SSE stream's terminal invalidation (see {@link useRunGroupStream}).
 */
export function useTestRunSchedules(agentFilter: string) {
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;

  const query = useQuery({
    queryKey: QUERY_KEYS.testRunSchedules(agentFilter, projectId),
    queryFn: () => testRunSchedulesApi.list({
      agentId: agentFilter || undefined,
      projectId: agentFilter ? undefined : projectId,
    }),
    enabled: currentProjectId !== null,
  });

  return { schedules: query.data ?? [], isLoading: query.isLoading };
}
