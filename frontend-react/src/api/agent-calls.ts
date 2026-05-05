import { api, qs } from './client';
import type { AgentCallDto, AgentCallFilter, PagedResult } from './models';

export const agentCallsApi = {
  list: (filter?: AgentCallFilter) =>
    api.get<PagedResult<AgentCallDto>>(`/api/agent-calls${qs((filter ?? {}) as Record<string, unknown>)}`),
  get: (id: string) => api.get<AgentCallDto>(`/api/agent-calls/${id}`),
  delete: (id: string) => api.del(`/api/agent-calls/${id}`),
};
