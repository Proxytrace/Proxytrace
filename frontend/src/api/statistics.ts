import { api, qs } from './client';
import type {
  AgentBreakdownDto,
  AgentEntityCountsDto,
  AgentOverviewDto,
  AgentPassRatePointDto,
  AgentSuitePassRateDto,
  AgentTimeSeriesPointDto,
  LatencyStatDto,
  ModelBreakdownDto,
  SummaryDto,
} from './models';
import type { StatisticsBucket } from '../lib/time-range';

type AgentRangeParams = { from: string; to: string; bucket: StatisticsBucket; [key: string]: string };

export const statisticsApi = {
  summary: (params?: { from?: string; to?: string; projectId?: string }) =>
    api.get<SummaryDto>(`/api/statistics/summary${qs(params ?? {})}`),
  latency: (params?: { from?: string; to?: string; agentId?: string; projectId?: string }) =>
    api.get<LatencyStatDto[]>(`/api/statistics/latency${qs(params ?? {})}`),
  modelBreakdown: (params?: { from?: string; to?: string; agentId?: string; projectId?: string }) =>
    api.get<ModelBreakdownDto[]>(`/api/statistics/model-breakdown${qs(params ?? {})}`),
  agentBreakdown: (params?: { from?: string; to?: string; projectId?: string }) =>
    api.get<AgentBreakdownDto[]>(`/api/statistics/agent-breakdown${qs(params ?? {})}`),

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
