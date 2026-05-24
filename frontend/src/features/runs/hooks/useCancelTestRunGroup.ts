import { useMutation, useQueryClient } from '@tanstack/react-query';
import { testRunGroupsApi } from '../../../api/test-run-groups';
import { QUERY_KEYS } from '../../../api/query-keys';

/** Cancels an in-flight run group and invalidates the group list. */
export function useCancelTestRunGroup(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => testRunGroupsApi.cancel(groupId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.testRunGroupsRoot }),
  });
}
