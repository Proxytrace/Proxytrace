import { useMutation, useQueryClient } from '@tanstack/react-query';
import { testRunGroupsApi } from '../../../api/test-run-groups';
import { QUERY_KEYS } from '../../../api/query-keys';

/** Deletes a run group and invalidates the group list. Caller resets its own selection state via `mutate`'s onSuccess. */
export function useDeleteTestRunGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => testRunGroupsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.testRunGroupsRoot }),
  });
}
