import { api, qs } from './client';
import type { AgenticEvaluatorPresetDto, CreateEvaluatorPayload, EvaluatorDetailDto } from './models';

export interface RecentEvaluationItemDto {
  testResultId: string;
  testCaseId: string;
  caseSummary: string;
  score: string | null;
  passed: boolean;
  reasoning: string | null;
  latencyMs: number;
  evaluatedAt: string;
}

export const evaluatorsApi = {
  list: (params?: { projectId?: string }) =>
    api.get<EvaluatorDetailDto[]>(`/api/evaluators${qs(params ?? {})}`),
  get: (id: string) => api.get<EvaluatorDetailDto>(`/api/evaluators/${id}`),
  create: (payload: CreateEvaluatorPayload) => api.post<EvaluatorDetailDto>('/api/evaluators', payload),
  update: (id: string, payload: Partial<CreateEvaluatorPayload>) =>
    api.put<EvaluatorDetailDto>(`/api/evaluators/${id}`, payload),
  delete: (id: string) => api.del(`/api/evaluators/${id}`),
  getAgenticPresets: () => api.get<AgenticEvaluatorPresetDto[]>('/api/evaluators/agentic-presets'),
  recentEvaluations: (evaluatorId: string, count = 8) =>
    api.get<RecentEvaluationItemDto[]>(`/api/evaluators/${encodeURIComponent(evaluatorId)}/recent-evaluations?count=${count}`),
};
