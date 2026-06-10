import { api, qs, type RequestOptions } from './client';
import type { AgentCallDto, AgentCallFilter, PagedResult, TracesOverviewDto, TraceHistogramBucket } from './models';

export const agentCallsApi = {
  list: (filter?: AgentCallFilter) =>
    api.get<PagedResult<AgentCallDto>>(`/api/agent-calls${qs((filter ?? {}) as Record<string, unknown>)}`),
  overview: (params?: { projectId?: string; agentId?: string; from?: string }) =>
    api.get<TracesOverviewDto>(`/api/agent-calls/overview${qs(params ?? {})}`),
  histogram: (filter: AgentCallFilter & { buckets?: number }) =>
    api.get<TraceHistogramBucket[]>(`/api/agent-calls/histogram${qs(filter as Record<string, unknown>)}`),
  get: (id: string, opts?: RequestOptions) => api.get<AgentCallDto>(`/api/agent-calls/${id}`, opts),
  delete: (id: string) => api.del(`/api/agent-calls/${id}`),
};
