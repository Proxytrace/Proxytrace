import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { agentCallsApi } from '../../../api/agent-calls';
import { QUERY_KEYS } from '../../../api/query-keys';
import { useSelectedId } from '../../../hooks/useSelectedId';
import type { AgentCallDto } from '../../../api/models';

/**
 * Keeps the open trace-detail selection in the URL (`?trace=<id>`) so it survives
 * refresh, back/forward, and link sharing — the app-wide master/detail convention
 * (see {@link useSelectedId}).
 *
 * The detail panel needs the full DTO, not just an id. We resolve it from the
 * already-loaded page when possible; only when the selected trace isn't on the
 * current page (a deep-link or a post-refresh restore) do we fetch it by id. That
 * fetch tolerates a stale id: a 404 is silent and simply yields no selection.
 */
export function useSelectedTrace(
  flatTraces: readonly AgentCallDto[],
): readonly [AgentCallDto | null, (id: string | null) => void] {
  const [selectedId, setSelectedId] = useSelectedId('trace');

  const inPage = selectedId ? flatTraces.find(t => t.id === selectedId) ?? null : null;

  const fetchId = selectedId && !inPage ? selectedId : null;
  const detailQuery = useQuery({
    queryKey: QUERY_KEYS.agentCall(fetchId ?? undefined),
    queryFn: () => {
      if (!fetchId) throw new Error('no trace id');
      return agentCallsApi.get(fetchId, { silentStatuses: [404] });
    },
    enabled: !!fetchId,
    // A stale deep-link id must not crash the page via the global error boundary.
    throwOnError: false,
    retry: false,
  });

  const selectedTrace = inPage ?? detailQuery.data ?? null;

  const select = useCallback((id: string | null) => setSelectedId(id), [setSelectedId]);

  return [selectedTrace, select] as const;
}
