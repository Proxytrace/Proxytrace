import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { agentsApi } from '../../../api/agents';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';
import { LIST_PAGE_SIZE } from '../../../lib/constants';

/** All agents (including system) for the current project. */
export function useAgents() {
  const { currentProjectId } = useCurrentProject();
  const query = useQuery({
    queryKey: QUERY_KEYS.agents(currentProjectId ?? undefined),
    queryFn: () => agentsApi.list({ projectId: currentProjectId ?? undefined, pageSize: LIST_PAGE_SIZE }),
    enabled: currentProjectId !== null,
  });
  return { allAgents: query.data?.items ?? [], isLoading: query.isLoading };
}

/** Deletes an agent, invalidates the agents list, then runs `onSuccess(id)`. */
export function useDeleteAgent(onSuccess: (deletedId: string) => void) {
  const qc = useQueryClient();
  const { currentProjectId } = useCurrentProject();
  return useMutation({
    mutationFn: (id: string) => agentsApi.delete(id),
    onSuccess: (_result, id) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.agents(currentProjectId ?? undefined) });
      onSuccess(id);
    },
  });
}
