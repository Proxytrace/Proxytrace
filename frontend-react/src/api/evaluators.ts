import { api } from './client';
import type { CreateEvaluatorPayload, EvaluatorDetailDto } from './models';

export const evaluatorsApi = {
  list: () => api.get<EvaluatorDetailDto[]>('/api/evaluators'),
  get: (id: string) => api.get<EvaluatorDetailDto>(`/api/evaluators/${id}`),
  create: (payload: CreateEvaluatorPayload) => api.post<EvaluatorDetailDto>('/api/evaluators', payload),
  update: (id: string, payload: Partial<CreateEvaluatorPayload>) =>
    api.put<EvaluatorDetailDto>(`/api/evaluators/${id}`, payload),
  delete: (id: string) => api.del(`/api/evaluators/${id}`),
};
