import { useQuery } from '@tanstack/react-query';
import { agentsApi } from '../../../api/agents';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';
import { LIST_PAGE_SIZE } from '../../../lib/constants';

/**
 * The agent's currently-deployed endpoint id — the model "in production". The run-comparison view
 * uses it to mark which run in a group is the baseline (see {@link buildLeaderboard}).
 *
 * Read from the light agents list, sharing {@link QUERY_KEYS.agents} so it reuses the cache the
 * agents feature already populates (no extra fetch when it's warm). Returns `null` when unknown —
 * the agent isn't on the first page, or the list hasn't loaded — and the comparison then falls back
 * to ranking by best pass rate, so this is a best-effort hint, not a hard dependency.
 */
export function useCurrentEndpointId(agentId: string): string | null {
  const { currentProjectId } = useCurrentProject();
  const { data } = useQuery({
    queryKey: QUERY_KEYS.agents(currentProjectId ?? undefined),
    queryFn: () => agentsApi.list({ projectId: currentProjectId ?? undefined, pageSize: LIST_PAGE_SIZE }),
    enabled: currentProjectId !== null,
  });
  return data?.items.find(a => a.id === agentId)?.endpointId ?? null;
}
