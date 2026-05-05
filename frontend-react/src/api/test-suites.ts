import { api, qs } from './client';
import type { PagedResult, TestRunDto, TestSuiteDto } from './models';

export interface CreateTestSuitePayload {
  name: string;
  agentId: string;
  agentCallIds: string[];
  evaluatorIds?: string[];
}

export const testSuitesApi = {
  list: (params?: { agentId?: string; page?: number; pageSize?: number }) =>
    api.get<PagedResult<TestSuiteDto>>(`/api/test-suites${qs(params ?? {})}`),
  get: (id: string) => api.get<TestSuiteDto>(`/api/test-suites/${id}`),
  create: (payload: CreateTestSuitePayload) =>
    api.post<TestSuiteDto>('/api/test-suites', payload),
  updateEvaluators: (id: string, evaluatorIds: string[]) =>
    api.put<TestSuiteDto>(`/api/test-suites/${id}`, { evaluatorIds }),
  delete: (id: string) => api.del(`/api/test-suites/${id}`),
  addTestCase: (suiteId: string, fromAgentCallId: string) =>
    api.post<TestSuiteDto>(`/api/test-suites/${suiteId}/test-cases`, { fromAgentCallId }),
  removeTestCase: (suiteId: string, caseId: string) =>
    api.del(`/api/test-suites/${suiteId}/test-cases/${caseId}`),
  run: (suiteId: string) => api.post<TestRunDto>(`/api/test-suites/${suiteId}/run`),
};
