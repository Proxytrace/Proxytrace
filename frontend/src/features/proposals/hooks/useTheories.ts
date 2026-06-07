import { useQuery, useQueryClient } from '@tanstack/react-query';
import { theoriesApi } from '../../../api/theories';
import { QUERY_KEYS } from '../../../api/query-keys';
import { TheoryStatus } from '../../../api/models';
import useCurrentProject from '../../../hooks/useCurrentProject';
import { REFETCH_INTERVAL_LIVE, REFETCH_INTERVAL_SLOW } from '../../../lib/constants';

/** A theory still moving through the pipeline — its state can change on the server at any moment. */
const isActive = (status: TheoryStatus) =>
  status === TheoryStatus.Proposed || status === TheoryStatus.Validating;

/**
 * Optimization theories for the current project. Polls live while any theory is still being
 * validated (so the board tracks server-side state changes), and slowly otherwise so newly
 * spawned theories still surface without a manual refresh.
 */
export function useTheories() {
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEYS.theories(undefined, projectId),
    queryFn: () => theoriesApi.getAll({ projectId }),
    refetchInterval: q =>
      (q.state.data ?? []).some(t => isActive(t.status)) ? REFETCH_INTERVAL_LIVE : REFETCH_INTERVAL_SLOW,
    enabled: currentProjectId !== null,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['theories'] });

  return { theories: query.data ?? [], isLoading: query.isLoading, refresh };
}
