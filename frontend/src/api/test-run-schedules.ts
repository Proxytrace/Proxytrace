import { api, qs } from './client';
import type {
  CreateTestRunScheduleRequest,
  TestRunGroupDto,
  TestRunScheduleDto,
  UpdateTestRunScheduleRequest,
} from './models';

export const testRunSchedulesApi = {
  list: (params?: { agentId?: string; projectId?: string }) =>
    api.get<TestRunScheduleDto[]>(`/api/test-run-schedules${qs(params ?? {})}`),
  create: (body: CreateTestRunScheduleRequest) =>
    api.post<TestRunScheduleDto>('/api/test-run-schedules', body),
  update: (id: string, body: UpdateTestRunScheduleRequest) =>
    api.patch<TestRunScheduleDto>(`/api/test-run-schedules/${id}`, body),
  delete: (id: string) => api.del(`/api/test-run-schedules/${id}`),
  runNow: (id: string) => api.post<TestRunGroupDto>(`/api/test-run-schedules/${id}/run-now`),
};
