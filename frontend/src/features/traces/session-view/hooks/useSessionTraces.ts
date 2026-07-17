import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { agentCallsApi } from '../../../../api/agent-calls';
import { QUERY_KEYS } from '../../../../api/query-keys';
import type { AgentCallFilter } from '../../../../api/models';
import { SORT_FIELD_TO_API, type TraceSort } from '../../tracesMeta';

/**
 * The session's traces, via the existing agent-calls list scoped by `sessionId`. Keyed on the full
 * filter through {@link QUERY_KEYS.agentCalls} so the SSE stream's `['agent-calls']` invalidation
 * refreshes it. Defaults to chronological (createdAt ascending) so live arrivals append at the
 * bottom; the table header can re-sort via `sort`.
 */
export function useSessionTraces(sessionId: string | null, page: number, pageSize: number, sort: TraceSort) {
  const filter: AgentCallFilter = {
    sessionId: sessionId ?? undefined,
    page,
    pageSize,
    sortBy: SORT_FIELD_TO_API[sort.field],
    sortDesc: sort.desc,
    // System agents are part of a session's real activity — never hide them here.
    includeSystemAgents: true,
  };
  const query = useQuery({
    queryKey: QUERY_KEYS.agentCalls(filter),
    queryFn: () => agentCallsApi.list(filter),
    placeholderData: keepPreviousData,
    enabled: !!sessionId,
  });
  return { traces: query.data?.items ?? [], total: query.data?.total ?? 0, isFetching: query.isFetching };
}
