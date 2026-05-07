import { api, qs } from './client';
import type { AgentDto, PagedResult } from './models';

export const agentsApi = {
  list: (params?: { projectId?: string; page?: number; pageSize?: number }) =>
    api.get<PagedResult<AgentDto>>(`/api/agents${qs(params ?? {})}`),
  get: (id: string) => api.get<AgentDto>(`/api/agents/${id}`),
  delete: (id: string) => api.del(`/api/agents/${id}`),
  updateEndpoint: (id: string, endpointId: string) =>
    api.patch<AgentDto>(`/api/agents/${id}/endpoint`, { endpointId }),
};
