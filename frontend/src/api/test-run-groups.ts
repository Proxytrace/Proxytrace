import { api, qs } from './client';
import type { PagedResult, TestRunGroupDto } from './models';

export const testRunGroupsApi = {
  list: (params?: { agentId?: string; projectId?: string; page?: number; pageSize?: number }) =>
    api.get<PagedResult<TestRunGroupDto>>(`/api/test-run-groups${qs(params ?? {})}`),
  get: (id: string) => api.get<TestRunGroupDto>(`/api/test-run-groups/${id}`),
  create: (testSuiteId: string, modelEndpointIds: string[]) =>
    api.post<TestRunGroupDto>('/api/test-run-groups', { testSuiteId, modelEndpointIds }),
  cancel: (id: string) => api.post<TestRunGroupDto>(`/api/test-run-groups/${id}/cancel`),
  delete: (id: string) => api.del(`/api/test-run-groups/${id}`),
};
