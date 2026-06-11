import { api, qs, type RequestOptions } from './client';
import type { SubmitTheoryRequest, TheoryDto, TheoryStatus } from './models';

export const theoriesApi = {
  getAll: (params?: { agentId?: string; projectId?: string; status?: TheoryStatus }) =>
    api.get<TheoryDto[]>(`/api/theories${qs(params ?? {})}`),
  get: (id: string, opts?: RequestOptions) => api.get<TheoryDto>(`/api/theories/${id}`, opts),
  submit: (request: SubmitTheoryRequest) => api.post<TheoryDto>('/api/theories', request),
  reset: (id: string) => api.post<TheoryDto>(`/api/theories/${id}/reset`, {}),
};
