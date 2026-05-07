import { api, qs } from './client';
import type { PagedResult, TestCaseFixtureDto, TestRunDto } from './models';

export const testRunsApi = {
  list: (params?: { agentId?: string; page?: number; pageSize?: number }) =>
    api.get<PagedResult<TestRunDto>>(`/api/test-runs${qs(params ?? {})}`),
  get: (id: string) => api.get<TestRunDto>(`/api/test-runs/${id}`),
  cancel: (id: string) => api.post<void>(`/api/test-runs/${id}/cancel`),
  delete: (id: string) => api.del(`/api/test-runs/${id}`),
  getFixture: (runId: string, caseId: string) =>
    api.get<TestCaseFixtureDto>(`/api/test-runs/${runId}/cases/${caseId}/fixture`),
};
