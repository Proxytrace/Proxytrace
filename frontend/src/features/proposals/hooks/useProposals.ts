import { useQuery } from '@tanstack/react-query';
import { proposalsApi } from '../../../api/proposals';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';
import { REFETCH_INTERVAL_LIVE } from '../../../lib/constants';

/**
 * Optimization proposals for the current project. Polls live while validation is in flight
 * (`poll`), since a validated theory spawns a proposal server-side; idle otherwise (status
 * changes are local mutations that invalidate this query).
 */
export function useProposals(poll = false) {
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;
  const query = useQuery({
    queryKey: QUERY_KEYS.proposals(undefined, projectId),
    queryFn: () => proposalsApi.getAll({ projectId }),
    refetchInterval: poll ? REFETCH_INTERVAL_LIVE : false,
    enabled: currentProjectId !== null,
  });
  return { proposals: query.data ?? [], isLoading: query.isLoading };
}
