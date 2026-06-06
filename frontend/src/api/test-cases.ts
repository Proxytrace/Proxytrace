import { api } from './client';
import type { TestCaseDto, TestSuiteMessageDto } from './models';

export const testCasesApi = {
  get: (id: string) => api.get<TestCaseDto>(`/api/test-cases/${id}`),
  update: (id: string, expectedOutput: TestSuiteMessageDto) =>
    api.put<TestCaseDto>(`/api/test-cases/${id}`, { expectedOutput }),
};
