import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { agentCallsApi } from '../../../api/agent-calls';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';
import { DEFAULT_PAGE_SIZE } from '../../../lib/constants';
import type { AgentCallFilter } from '../../../api/models';
import { advancedFilterParams, DEFAULT_TRACE_SORT, SORT_FIELD_TO_API, type TraceAdvancedFilters, type TraceSort } from '../tracesMeta';

/** Default page size; the user can override it via the page-size selector. */
export const PAGE_SIZE = DEFAULT_PAGE_SIZE;

/** Selectable page sizes for the traces table. */
export const PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const;

interface TraceFilter {
  page: number;
  pageSize: number;
  advanced: TraceAdvancedFilters;
  debouncedSearch: string;
  showSystem: boolean;
  from: string | undefined;
  to: string | undefined;
  sort: TraceSort;
}

/**
 * Two queries serve the Traces page: the paginated call list (changes per page/search/filter/sort)
 * and a filter-bar overview (agents + breakdown + latency, keyed only on range/agent/project so it
 * survives pagination).
 */
export function useTraceQueries({ page, pageSize, advanced, debouncedSearch, showSystem, from, to, sort }: TraceFilter) {
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;
  const enabled = currentProjectId !== null;

  const trimmedSearch = debouncedSearch.trim();
  const filter: AgentCallFilter = {
    page,
    pageSize,
    includeSystemAgents: showSystem,
    ...advancedFilterParams(advanced),
    ...(projectId ? { projectId } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(trimmedSearch.length >= 2 ? { q: trimmedSearch } : {}),
    // Default (time desc) stays implicit so existing query keys — and the backend default — hold.
    ...(sort.field !== DEFAULT_TRACE_SORT.field || sort.desc !== DEFAULT_TRACE_SORT.desc
      ? { sortBy: SORT_FIELD_TO_API[sort.field], sortDesc: sort.desc }
      : {}),
  };

  const tracesQuery = useQuery({
    queryKey: QUERY_KEYS.agentCalls(filter),
    queryFn: () => agentCallsApi.list(filter),
    placeholderData: keepPreviousData,
    enabled,
  });

  const overviewQuery = useQuery({
    queryKey: QUERY_KEYS.agentCallsOverview(from, advanced.agent || undefined, projectId),
    queryFn: () => agentCallsApi.overview({ from, agentId: advanced.agent || undefined, projectId }),
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
