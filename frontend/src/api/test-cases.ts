import { api } from './client';
import type { TestCaseDto } from './models';

export const testCasesApi = {
  get: (id: string) => api.get<TestCaseDto>(`/api/test-cases/${id}`),
};
