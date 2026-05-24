import { useQuery } from '@tanstack/react-query';
import { proposalsApi } from '../../../api/proposals';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';

/** Optimization proposals for the current project. */
export function useProposals() {
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;
  const query = useQuery({
    queryKey: QUERY_KEYS.proposals(undefined, projectId),
    queryFn: () => proposalsApi.getAll({ projectId }),
    enabled: currentProjectId !== null,
  });
  return { proposals: query.data ?? [], isLoading: query.isLoading };
}
