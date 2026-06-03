import { useQuery, useQueryClient } from '@tanstack/react-query';
import { theoriesApi } from '../../../api/theories';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';

/** Optimization theories for the current project, kept fresh via the theory SSE stream. */
export function useTheories() {
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEYS.theories(undefined, projectId),
    queryFn: () => theoriesApi.getAll({ projectId }),
    enabled: currentProjectId !== null,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['theories'] });

  return { theories: query.data ?? [], isLoading: query.isLoading, refresh };
}
