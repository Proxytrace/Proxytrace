import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { agentCallsApi } from '../../../api/agent-calls';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';
import { DEFAULT_PAGE_SIZE } from '../../../lib/constants';
import type { AgentCallFilter } from '../../../api/models';

/** Default page size; the user can override it via the page-size selector. */
export const PAGE_SIZE = DEFAULT_PAGE_SIZE;

/** Selectable page sizes for the traces table. */
export const PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const;

interface TraceFilter {
  page: number;
  pageSize: number;
  range: string;
  agentFilter: string;
  debouncedSearch: string;
  showSystem: boolean;
  from: string | undefined;
}

/**
 * Two queries serve the Traces page: the paginated call list (changes per page/search) and a
 * filter-bar overview (agents + breakdown + latency, keyed only on range/agent/project so it
 * survives pagination).
 */
export function useTraceQueries({ page, pageSize, agentFilter, debouncedSearch, showSystem, from }: TraceFilter) {
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;
  const enabled = currentProjectId !== null;

  const trimmedSearch = debouncedSearch.trim();
  const filter: AgentCallFilter = {
    page,
    pageSize,
    includeSystemAgents: showSystem,
    ...(projectId ? { projectId } : {}),
    ...(agentFilter ? { agentId: agentFilter } : {}),
    ...(from ? { from } : {}),
    ...(trimmedSearch.length >= 2 ? { q: trimmedSearch } : {}),
  };

  const tracesQuery = useQuery({
    queryKey: QUERY_KEYS.agentCalls(filter),
    queryFn: () => agentCallsApi.list(filter),
    placeholderData: keepPreviousData,
    enabled,
  });

  const overviewQuery = useQuery({
    queryKey: QUERY_KEYS.agentCallsOverview(from, agentFilter || undefined, projectId),
    queryFn: () => agentCallsApi.overview({ from, agentId: agentFilter || undefined, projectId }),
    placeholderData: keepPreviousData,
    enabled,
  });

  return {
    traces: tracesQuery.data?.items ?? [],
    total: tracesQuery.data?.total ?? 0,
    isFetching: tracesQuery.isFetching,
    allAgents: overviewQuery.data?.agents ?? [],
    agentBreakdown: overviewQuery.data?.agentBreakdown ?? [],
    p95: overviewQuery.data?.latency?.[0]?.p95Ms ?? null,
  };
}
