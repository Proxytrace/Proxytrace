import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { agentCallsApi } from '../../../api/agent-calls';
import { agentsApi } from '../../../api/agents';
import { statisticsApi } from '../../../api/statistics';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';
import { DEFAULT_PAGE_SIZE } from '../../../lib/constants';
import type { AgentCallFilter } from '../../../api/models';

export const PAGE_SIZE = DEFAULT_PAGE_SIZE;

interface TraceFilter {
  page: number;
  range: string;
  agentFilter: string;
  debouncedSearch: string;
  showSystem: boolean;
  from: string | undefined;
}

/** All four queries needed by the Traces page. */
export function useTraceQueries({ page, agentFilter, debouncedSearch, showSystem, from }: TraceFilter) {
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;
  const enabled = currentProjectId !== null;

  const trimmedSearch = debouncedSearch.trim();
  const filter: AgentCallFilter = {
    page,
    pageSize: PAGE_SIZE,
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

  const agentsQuery = useQuery({
    queryKey: QUERY_KEYS.agents(projectId),
    queryFn: () => agentsApi.list({ projectId, pageSize: 200 }),
    enabled,
  });

  const agentBreakdownQuery = useQuery({
    queryKey: QUERY_KEYS.statisticsAgentBreakdown(from, projectId),
    queryFn: () => statisticsApi.agentBreakdown({ from, projectId }),
    enabled,
  });

  const latencyQuery = useQuery({
    queryKey: QUERY_KEYS.statisticsLatency(from, agentFilter || undefined, projectId),
    queryFn: () => statisticsApi.latency({ from, agentId: agentFilter || undefined, projectId }),
    enabled,
  });

  return {
    traces: tracesQuery.data?.items ?? [],
    total: tracesQuery.data?.total ?? 0,
    isFetching: tracesQuery.isFetching,
    allAgents: agentsQuery.data?.items ?? [],
    agentBreakdown: agentBreakdownQuery.data ?? [],
    p95: latencyQuery.data?.[0]?.p95Ms ?? null,
  };
}
