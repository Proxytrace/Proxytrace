import { api, qs, type RequestOptions } from './client';
import type { PagedResult, TestRunGroupDto, TestRunGroupListItemDto } from './models';

export const testRunGroupsApi = {
  list: (params?: { suiteId?: string; agentId?: string; projectId?: string; includeSystem?: boolean; page?: number; pageSize?: number }) =>
    api.get<PagedResult<TestRunGroupListItemDto>>(`/api/test-run-groups${qs(params ?? {})}`),
  get: (id: string, opts?: RequestOptions) => api.get<TestRunGroupDto>(`/api/test-run-groups/${id}`, opts),
  create: (testSuiteId: string, modelEndpointIds: string[]) =>
    api.post<TestRunGroupDto>('/api/test-run-groups', { testSuiteId, modelEndpointIds }),
  cancel: (id: string) => api.post<TestRunGroupDto>(`/api/test-run-groups/${id}/cancel`),
  delete: (id: string) => api.del(`/api/test-run-groups/${id}`),
};
