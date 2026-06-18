import { useMutation, useQueryClient } from '@tanstack/react-query';
import { testRunSchedulesApi } from '../../../api/test-run-schedules';
import { QUERY_KEYS } from '../../../api/query-keys';
import type {
  CreateTestRunScheduleRequest,
  UpdateTestRunScheduleRequest,
} from '../../../api/models';

/**
 * Create / update / delete / run-now mutations for test-run schedules. Every success invalidates the
 * whole `test-run-schedules` cache (by prefix) so the list reflects the change without manual patching.
 */
export function useTestRunScheduleMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: QUERY_KEYS.testRunSchedulesRoot });

  const create = useMutation({
    mutationFn: (body: CreateTestRunScheduleRequest) => testRunSchedulesApi.create(body),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateTestRunScheduleRequest }) =>
      testRunSchedulesApi.update(id, body),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => testRunSchedulesApi.delete(id),
    onSuccess: invalidate,
  });

  const runNow = useMutation({
    mutationFn: (id: string) => testRunSchedulesApi.runNow(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.testRunSchedulesRoot });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.testRunGroupsRoot });
    },
  });

  return { create, update, remove, runNow };
}
