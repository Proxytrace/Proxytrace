import { api, qs } from './client';
import type {
  AgentBreakdownDto,
  AgentEntityCountsDto,
  AgentOverviewDto,
  AgentPassRatePointDto,
  AgentSuitePassRateDto,
  AgentTimeSeriesPointDto,
  AgentTokenUsageDto,
  CostEstimateDto,
  DashboardTrendsDto,
  ErrorRateDto,
  EvaluatorOverviewDto,
  EvaluatorSparklineDto,
  LatencyStatDto,
  LiveTelemetryDto,
  ModelBreakdownDto,
  PassRateDto,
  SummaryDto,
  TokenUsageDto,
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
  tokenUsage: (params?: { from?: string; to?: string; agentId?: string; projectId?: string; endPointId?: string }) =>
    api.get<TokenUsageDto[]>(`/api/statistics/token-usage${qs(params ?? {})}`),
  passRates: (params?: { from?: string; to?: string; agentId?: string; projectId?: string; endpointId?: string }) =>
    api.get<PassRateDto[]>(`/api/statistics/pass-rates${qs(params ?? {})}`),
  errorRates: (params?: { from?: string; to?: string; agentId?: string; projectId?: string; endpointId?: string }) =>
    api.get<ErrorRateDto[]>(`/api/statistics/error-rates${qs(params ?? {})}`),
  costEstimate: (params?: { from?: string; to?: string; agentId?: string; projectId?: string; endpointId?: string }) =>
    api.get<CostEstimateDto[]>(`/api/statistics/cost-estimate${qs(params ?? {})}`),
  liveTelemetry: (params?: { projectId?: string }) =>
    api.get<LiveTelemetryDto>(`/api/statistics/live-telemetry${qs(params ?? {})}`),
  tokenUsageByAgent: (params?: { from?: string; to?: string; projectId?: string }) =>
    api.get<AgentTokenUsageDto[]>(`/api/statistics/token-usage-by-agent${qs(params ?? {})}`),
  dashboardTrends: (params?: { from?: string; to?: string; projectId?: string }) =>
    api.get<DashboardTrendsDto>(`/api/statistics/dashboard-trends${qs(params ?? {})}`),

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

  evaluatorOverview: (evaluatorId: string, params: AgentRangeParams) =>
    api.get<EvaluatorOverviewDto>(`/api/statistics/evaluators/${evaluatorId}/overview${qs(params)}`),
  evaluatorSparklines: (params: { projectId: string; from: string; to: string; bucket: StatisticsBucket; [key: string]: string }) =>
    api.get<EvaluatorSparklineDto[]>(`/api/statistics/evaluators/sparklines${qs(params)}`),
};
