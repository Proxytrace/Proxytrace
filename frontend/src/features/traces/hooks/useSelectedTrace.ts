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
 * The list now carries only light {@link AgentCallListItemDto} rows, so the detail panel always
 * fetches the full {@link AgentCallDto} by id — never resolving it from the in-page row. The fetch
 * tolerates a stale id: a 404 is silent and simply yields no selection.
 */
export function useSelectedTrace(): readonly [AgentCallDto | null, (id: string | null) => void] {
  const [selectedId, setSelectedId] = useSelectedId('trace');

  const detailQuery = useQuery({
    queryKey: QUERY_KEYS.agentCall(selectedId ?? undefined),
    queryFn: () => {
      if (!selectedId) throw new Error('no trace id');
      return agentCallsApi.get(selectedId, { silentStatuses: [404] });
    },
    enabled: !!selectedId,
    // A stale deep-link id must not crash the page via the global error boundary.
    throwOnError: false,
    retry: false,
  });

  const selectedTrace = detailQuery.data ?? null;

  const select = useCallback((id: string | null) => setSelectedId(id), [setSelectedId]);

  return [selectedTrace, select] as const;
}
