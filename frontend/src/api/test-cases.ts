import { api, type RequestOptions } from './client';
import type { TestCaseDto, TestSuiteMessageDto } from './models';

export const testCasesApi = {
  get: (id: string, opts?: RequestOptions) => api.get<TestCaseDto>(`/api/test-cases/${id}`, opts),
  update: (id: string, expectedOutput: TestSuiteMessageDto, opts?: RequestOptions) =>
    api.put<TestCaseDto>(`/api/test-cases/${id}`, { expectedOutput }, opts),
};
