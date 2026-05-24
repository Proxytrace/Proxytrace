// All TanStack Query hooks for the Dashboard. Grouped by concern.
// Keys sourced from QUERY_KEYS; no raw useQuery in the page component.

import { useQuery } from '@tanstack/react-query';
import { statisticsApi } from '../../../api/statistics';
import { agentCallsApi } from '../../../api/agent-calls';
import { agentsApi } from '../../../api/agents';
import { QUERY_KEYS } from '../../../api/query-keys';
import { REFETCH_INTERVAL_FAST, REFETCH_INTERVAL_SLOW } from '../../../lib/constants';

interface DashboardQueryOptions {
  from: string;
  projectId: string | undefined;
  enabled: boolean;
}

// ── Summary & telemetry ──────────────────────────────────────────────────────

export function useDashboardSummary({ from, projectId, enabled }: DashboardQueryOptions) {
  return useQuery({
    queryKey: QUERY_KEYS.statisticsSummary(from, projectId),
    queryFn: () => statisticsApi.summary({ from, projectId }),
    refetchInterval: REFETCH_INTERVAL_FAST,
    enabled,
  });
}

export function useLiveTelemetry({ projectId, enabled }: Pick<DashboardQueryOptions, 'projectId' | 'enabled'>) {
  return useQuery({
    queryKey: QUERY_KEYS.statisticsLiveTelemetry(projectId),
    queryFn: () => statisticsApi.liveTelemetry({ projectId }),
    refetchInterval: REFETCH_INTERVAL_FAST,
    enabled,
    retry: false,
  });
}

export function useDashboardTrends({ from, projectId, enabled }: DashboardQueryOptions) {
  return useQuery({
    queryKey: QUERY_KEYS.statisticsDashboardTrends(from, projectId),
    queryFn: () => statisticsApi.dashboardTrends({ from, projectId }),
    refetchInterval: REFETCH_INTERVAL_FAST,
    enabled,
    retry: false,
  });
}

// ── Traces & agents ──────────────────────────────────────────────────────────

export function useRecentTraces({ from, projectId, enabled }: DashboardQueryOptions) {
  return useQuery({
    queryKey: QUERY_KEYS.agentCalls({ page: 1, pageSize: 6, from, projectId }),
    queryFn: () => agentCallsApi.list({ page: 1, pageSize: 6, from, projectId }),
    refetchInterval: REFETCH_INTERVAL_FAST,
    enabled,
  });
}

export function useDashboardAgents({ projectId, enabled }: Pick<DashboardQueryOptions, 'projectId' | 'enabled'>) {
  return useQuery({
    queryKey: QUERY_KEYS.agents(projectId),
    queryFn: () => agentsApi.list({ projectId, pageSize: 10 }),
    refetchInterval: REFETCH_INTERVAL_SLOW,
    enabled,
  });
}

// ── Breakdowns ───────────────────────────────────────────────────────────────

export function useAgentBreakdown({ from, projectId, enabled }: DashboardQueryOptions) {
  return useQuery({
    queryKey: QUERY_KEYS.statisticsAgentBreakdown(from, projectId),
    queryFn: () => statisticsApi.agentBreakdown({ from, projectId }),
    refetchInterval: REFETCH_INTERVAL_FAST,
    enabled,
  });
}

export function useLatencyStats({ from, projectId, enabled }: DashboardQueryOptions) {
  return useQuery({
    queryKey: QUERY_KEYS.statisticsLatency(from, undefined, projectId),
    queryFn: () => statisticsApi.latency({ from, projectId }),
    refetchInterval: REFETCH_INTERVAL_FAST,
    enabled,
  });
}

export function useModelBreakdown({ from, projectId, enabled }: DashboardQueryOptions) {
  return useQuery({
    queryKey: QUERY_KEYS.statisticsModelBreakdown(from, undefined, projectId),
    queryFn: () => statisticsApi.modelBreakdown({ from, projectId }),
    refetchInterval: REFETCH_INTERVAL_FAST,
    enabled,
  });
}

export function useTokenUsage({ from, projectId, enabled }: DashboardQueryOptions) {
  return useQuery({
    queryKey: QUERY_KEYS.statisticsTokenUsage(from, undefined, projectId),
    queryFn: () => statisticsApi.tokenUsage({ from, projectId }),
    refetchInterval: REFETCH_INTERVAL_FAST,
    enabled,
  });
}

export function useTokenUsageByAgent({ from, projectId, enabled }: DashboardQueryOptions) {
  return useQuery({
    queryKey: QUERY_KEYS.statisticsTokenUsageByAgent(from, projectId),
    queryFn: () => statisticsApi.tokenUsageByAgent({ from, projectId }),
    refetchInterval: REFETCH_INTERVAL_FAST,
    enabled,
    retry: false,
  });
}
