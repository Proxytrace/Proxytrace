import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { anomaliesApi } from '../../../api/anomalies';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';

export const RECENT_PAGE_SIZE = 20;

/**
 * Paged recent flagged calls (traces list-item shape), scoped to the current project and optionally
 * one agent. Keeps the previous page visible while the next loads so pagination doesn't flash empty.
 */
export function useRecentAnomalies(agentFilter: string, page: number) {
  const { currentProjectId } = useCurrentProject();

  const params = {
    projectId: currentProjectId ?? undefined,
    ...(agentFilter ? { agentId: agentFilter } : {}),
    page,
    pageSize: RECENT_PAGE_SIZE,
  };

  const query = useQuery({
    queryKey: QUERY_KEYS.anomaliesRecent(params),
    queryFn: () => anomaliesApi.recent(params),
    enabled: currentProjectId !== null,
    placeholderData: keepPreviousData,
  });

  return {
    items: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
