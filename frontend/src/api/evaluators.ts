import { api, qs } from './client';
import type {
  AgenticEvaluatorPresetDto,
  CreateEvaluatorPayload,
  EvaluatorDetailDto,
  EvaluatorOverviewDto,
  EvaluatorSparklineDto,
  UpdateEvaluatorPayload,
} from './models';
import type { StatisticsBucket } from '../lib/time-range';

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

/** Lean test-suite reference for computing evaluator attachment. */
export interface EvaluatorSuiteRefDto {
  id: string;
  name: string;
  agentName: string;
  evaluatorIds: string[];
}

/** Single-call payload for the Evaluators list page. */
export interface EvaluatorsOverviewDto {
  evaluators: EvaluatorDetailDto[];
  suites: EvaluatorSuiteRefDto[];
  sparklines: EvaluatorSparklineDto[];
}

/** Single-call payload for one evaluator's detail view. */
export interface EvaluatorDetailViewDto {
  overview: EvaluatorOverviewDto;
  recentEvaluations: RecentEvaluationItemDto[];
}

type RangeParams = { from: string; to: string; bucket: StatisticsBucket; [key: string]: string };

export const evaluatorsApi = {
  list: (params?: { projectId?: string }) =>
    api.get<EvaluatorDetailDto[]>(`/api/evaluators${qs(params ?? {})}`),
  /** List page: evaluators + suite attachment refs + sparklines in one request. */
  overview: (params: { projectId?: string; from?: string; to?: string; bucket?: StatisticsBucket }) =>
    api.get<EvaluatorsOverviewDto>(`/api/evaluators/overview${qs(params)}`),
  /** Detail page: statistics overview + recent evaluations in one request. */
  detail: (evaluatorId: string, params: RangeParams & { recentCount?: number }) =>
    api.get<EvaluatorDetailViewDto>(`/api/evaluators/${encodeURIComponent(evaluatorId)}/detail${qs(params)}`),
  get: (id: string) => api.get<EvaluatorDetailDto>(`/api/evaluators/${id}`),
  create: (payload: CreateEvaluatorPayload) => api.post<EvaluatorDetailDto>('/api/evaluators', payload),
  update: (id: string, payload: UpdateEvaluatorPayload) =>
    api.put<EvaluatorDetailDto>(`/api/evaluators/${id}`, payload),
  delete: (id: string) => api.del(`/api/evaluators/${id}`),
  getAgenticPresets: () => api.get<AgenticEvaluatorPresetDto[]>('/api/evaluators/agentic-presets'),
};
