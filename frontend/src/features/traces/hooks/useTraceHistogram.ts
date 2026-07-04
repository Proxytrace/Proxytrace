import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { agentCallsApi } from '../../../api/agent-calls';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';
import type { AgentCallFilter, TraceHistogramBucket } from '../../../api/models';
import { advancedFilterParams, type TraceAdvancedFilters } from '../tracesMeta';

// Bucketing is done in-memory server-side (AgentCallHistogram.Build) after the rows are already
// projected, so a higher count costs nothing on the DB — only a marginally larger JSON payload.
// 120 ≈ 2px-wide bars at typical strip widths: crisp resolution without over-fetching. The API
// clamps to 240.
const BUCKETS = 120;

interface Params {
  from: string | undefined;
  to: string | undefined;
  advanced: TraceAdvancedFilters;
  debouncedSearch: string;
  showSystem: boolean;
}

/** Count+error timeline for the active time-range window, respecting all other filters. */
export function useTraceHistogram({ from, to, advanced, debouncedSearch, showSystem }: Params): {
  buckets: TraceHistogramBucket[];
  isFetching: boolean;
} {
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;
  const enabled = currentProjectId !== null;

  const trimmedSearch = debouncedSearch.trim();
  const filter: AgentCallFilter & { buckets: number } = {
    buckets: BUCKETS,
    includeSystemAgents: showSystem,
    ...advancedFilterParams(advanced),
    ...(projectId ? { projectId } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(trimmedSearch.length >= 2 ? { q: trimmedSearch } : {}),
  };

  const query = useQuery({
    queryKey: QUERY_KEYS.agentCallsHistogram(filter),
    queryFn: () => agentCallsApi.histogram(filter),
    placeholderData: keepPreviousData,
    enabled,
  });

  return { buckets: query.data ?? [], isFetching: query.isFetching };
}
