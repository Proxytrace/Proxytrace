import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { agentCallsApi } from '../../../api/agent-calls';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';
import type { AgentCallFilter, TraceHistogramBucket } from '../../../api/models';

const BUCKETS = 64;

interface Params {
  from: string | undefined;
  agentFilter: string;
  debouncedSearch: string;
  showSystem: boolean;
}

/** Count+error timeline for the current preset window, ignoring the brush sub-range. */
export function useTraceHistogram({ from, agentFilter, debouncedSearch, showSystem }: Params): {
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
    ...(projectId ? { projectId } : {}),
    ...(agentFilter ? { agentId: agentFilter } : {}),
    ...(from ? { from } : {}),
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
