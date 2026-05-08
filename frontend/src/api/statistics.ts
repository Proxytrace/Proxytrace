import { api, qs } from './client';
import type { AgentBreakdownDto, LatencyStatDto, ModelBreakdownDto, SummaryDto } from './models';

export const statisticsApi = {
  summary: (params?: { from?: string; to?: string }) =>
    api.get<SummaryDto>(`/api/statistics/summary${qs(params ?? {})}`),
  latency: (params?: { from?: string; to?: string; agentId?: string }) =>
    api.get<LatencyStatDto[]>(`/api/statistics/latency${qs(params ?? {})}`),
  modelBreakdown: (params?: { from?: string; to?: string; agentId?: string }) =>
    api.get<ModelBreakdownDto[]>(`/api/statistics/model-breakdown${qs(params ?? {})}`),
  agentBreakdown: (params?: { from?: string; to?: string }) =>
    api.get<AgentBreakdownDto[]>(`/api/statistics/agent-breakdown${qs(params ?? {})}`),
};
