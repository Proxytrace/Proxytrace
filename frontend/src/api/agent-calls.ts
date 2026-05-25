import { api, qs } from './client';
import type { AgentCallDto, AgentCallFilter, PagedResult, TracesOverviewDto } from './models';

export const agentCallsApi = {
  list: (filter?: AgentCallFilter) =>
    api.get<PagedResult<AgentCallDto>>(`/api/agent-calls${qs((filter ?? {}) as Record<string, unknown>)}`),
  overview: (params?: { projectId?: string; agentId?: string; from?: string }) =>
    api.get<TracesOverviewDto>(`/api/agent-calls/overview${qs(params ?? {})}`),
  get: (id: string) => api.get<AgentCallDto>(`/api/agent-calls/${id}`),
  delete: (id: string) => api.del(`/api/agent-calls/${id}`),
};
