import { api, qs } from './client';
import type { SubmitTheoryRequest, TheoryDto, TheoryStatus } from './models';

export const theoriesApi = {
  getAll: (params?: { agentId?: string; projectId?: string; status?: TheoryStatus }) =>
    api.get<TheoryDto[]>(`/api/theories${qs(params ?? {})}`),
  get: (id: string) => api.get<TheoryDto>(`/api/theories/${id}`),
  submit: (request: SubmitTheoryRequest) => api.post<TheoryDto>('/api/theories', request),
};
