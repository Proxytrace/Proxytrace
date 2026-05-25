import { api, qs } from './client';
import type {
  AgentEntityCountsDto,
  AgentOverviewDto,
  AgentPassRatePointDto,
  AgentSuitePassRateDto,
  AgentTimeSeriesPointDto,
  CostEstimateDto,
  DashboardViewDto,
  ErrorRateDto,
  PassRateDto,
} from './models';
import type { StatisticsBucket } from '../lib/time-range';

type AgentRangeParams = { from: string; to: string; bucket: StatisticsBucket; [key: string]: string };

export const statisticsApi = {
  /** One-shot dashboard payload (replaces the per-widget request fan-out). */
  dashboard: (params?: { from?: string; to?: string; projectId?: string }) =>
    api.get<DashboardViewDto>(`/api/statistics/dashboard${qs(params ?? {})}`),
  passRates: (params?: { from?: string; to?: string; agentId?: string; projectId?: string; endpointId?: string }) =>
    api.get<PassRateDto[]>(`/api/statistics/pass-rates${qs(params ?? {})}`),
  errorRates: (params?: { from?: string; to?: string; agentId?: string; projectId?: string; endpointId?: string }) =>
    api.get<ErrorRateDto[]>(`/api/statistics/error-rates${qs(params ?? {})}`),
  costEstimate: (params?: { from?: string; to?: string; agentId?: string; projectId?: string; endpointId?: string }) =>
    api.get<CostEstimateDto[]>(`/api/statistics/cost-estimate${qs(params ?? {})}`),

  agentOverview: (agentId: string, params: AgentRangeParams) =>
    api.get<AgentOverviewDto>(`/api/statistics/agents/${agentId}/overview${qs(params)}`),
  agentTimeSeries: (agentId: string, params: AgentRangeParams) =>
    api.get<AgentTimeSeriesPointDto[]>(`/api/statistics/agents/${agentId}/time-series${qs(params)}`),
  agentPassRateTrend: (agentId: string, params: AgentRangeParams) =>
    api.get<AgentPassRatePointDto[]>(`/api/statistics/agents/${agentId}/pass-rate-trend${qs(params)}`),
  agentSuitePassRates: (agentId: string) =>
    api.get<AgentSuitePassRateDto[]>(`/api/statistics/agents/${agentId}/suite-pass-rates`),
  agentCounts: (agentId: string) =>
    api.get<AgentEntityCountsDto>(`/api/statistics/agents/${agentId}/counts`),
};
