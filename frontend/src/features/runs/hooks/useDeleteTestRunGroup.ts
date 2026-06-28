import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { testRunGroupsApi } from '../../../api/test-run-groups';
import { QUERY_KEYS } from '../../../api/query-keys';
import type { PagedResult, TestRunGroupListItemDto } from '../../../api/models';

/**
 * Deletes a run group and refreshes the list. Caller resets its own selection state via `mutate`'s
 * `onSuccess`.
 *
 * The naive "invalidate the whole `test-run-groups` namespace" refetches the *deleted* group's detail
 * query (`GET /{id}` → 404, surfaced as an error toast) because that key shares the namespace prefix.
 * So we (1) forget the deleted group's detail query, (2) optimistically drop it from every cached list
 * page so the rail updates instantly and the selection falls through to a live group instead of
 * re-mounting the dead one, then (3) invalidate the lists — but never a detail query.
 */
export function useDeleteTestRunGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => testRunGroupsApi.delete(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: QUERY_KEYS.testRunGroup(id) });

      qc.setQueriesData<InfiniteData<PagedResult<TestRunGroupListItemDto>>>(
        { queryKey: QUERY_KEYS.testRunGroupsRoot },
        data => data && 'pages' in data
          ? { ...data, pages: data.pages.map(page => ({ ...page, items: page.items.filter(g => g.id !== id) })) }
          : data,
      );

      qc.invalidateQueries({ queryKey: QUERY_KEYS.testRunGroupsRoot, predicate: q => q.queryKey[1] !== 'detail' });
      // A deleted run changes the owning suite's aggregates and any schedule's recent-runs.
      qc.invalidateQueries({ queryKey: QUERY_KEYS.testSuitesRoot });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.testRunSchedulesRoot });
    },
  });
}
