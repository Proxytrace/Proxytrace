import { api, qs } from './client';
import type { ModelRequestPreviewDto, PagedResult, TestCaseFixtureDto, TestRunDto } from './models';

export const testRunsApi = {
  list: (params?: { agentId?: string; page?: number; pageSize?: number }) =>
    api.get<PagedResult<TestRunDto>>(`/api/test-runs${qs(params ?? {})}`),
  get: (id: string) => api.get<TestRunDto>(`/api/test-runs/${id}`),
  cancel: (id: string) => api.post<void>(`/api/test-runs/${id}/cancel`),
  delete: (id: string) => api.del(`/api/test-runs/${id}`),
  getFixture: (runId: string, caseId: string) =>
    // A run may have no result for the case (added after the run ran) → 404 is expected, not an error.
    api.get<TestCaseFixtureDto>(`/api/test-runs/${runId}/cases/${caseId}/fixture`, { silentStatuses: [404] }),
  getRequest: (runId: string, caseId: string) =>
    // The exact model request (model + messages + tools) this run sends for the case — rebuilt on demand.
    api.get<ModelRequestPreviewDto>(`/api/test-runs/${runId}/cases/${caseId}/request`, { silentStatuses: [404] }),
};
