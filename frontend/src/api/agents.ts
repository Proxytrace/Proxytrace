import { api, qs, type RequestOptions } from './client';
import type { AgentDto, AgentListItemDto, AgentVersionDto, PagedResult } from './models';

export const agentsApi = {
  list: (params?: { projectId?: string; page?: number; pageSize?: number }) =>
    api.get<PagedResult<AgentListItemDto>>(`/api/agents${qs(params ?? {})}`),
  get: (id: string, opts?: RequestOptions) => api.get<AgentDto>(`/api/agents/${id}`, opts),
  delete: (id: string) => api.del(`/api/agents/${id}`),
  updateEndpoint: (id: string, endpointId: string) =>
    api.patch<AgentDto>(`/api/agents/${id}/endpoint`, { endpointId }),
  listVersions: (id: string) =>
    api.get<AgentVersionDto[]>(`/api/agents/${id}/versions`),
};

export const agentVersionsApi = {
  get: (id: string) => api.get<AgentVersionDto>(`/api/agent-versions/${id}`),
  move: (id: string, targetAgentId: string) =>
    api.post<void>(`/api/agent-versions/${id}/move`, { targetAgentId }),
};
