import { useQuery, useQueryClient } from '@tanstack/react-query';
import { testRunGroupsApi } from '../../../../api/test-run-groups';
import { QUERY_KEYS } from '../../../../api/query-keys';
import { useTestRunGroupStream } from '../../../../api/event-stream';
import type { TestRunGroupDto } from '../../../../api/models';
import { isActive } from '../../../runs/results';
import { applyGroupComplete, applyRunComplete, patchGroupWithResult } from './live-run-progress';

/**
 * Keeps a just-started test-run group live inside the chat card. Seeds from the `start_test_run`
 * result, re-syncs once from the API on mount (so a reload that missed the SSE events still shows
 * the real state), and patches the cache in place as run events arrive — never refetching the
 * group on an event (BEST_PRACTICES §3.2). The stream is only opened while the group is still
 * active, so a finished run (or a reload of one) holds no EventSource open.
 */
export function useLiveTestRunGroup(initial: TestRunGroupDto): TestRunGroupDto {
  const queryClient = useQueryClient();
  const key = QUERY_KEYS.testRunGroup(initial.id);

  const query = useQuery({
    queryKey: key,
    queryFn: () => testRunGroupsApi.get(initial.id),
    initialData: initial,
  });

  const group = query.data ?? initial;

  useTestRunGroupStream(isActive(group.status) ? initial.id : null, (event) => {
    queryClient.setQueryData<TestRunGroupDto>(key, (prev) => {
      if (!prev) return prev;
      if (event.type === 'test-result-arrived') return patchGroupWithResult(prev, event);
      if (event.type === 'run-complete') return applyRunComplete(prev, event);
      if (event.type === 'group-run-complete') return applyGroupComplete(prev, event);
      return prev;
    });
  });

  return group;
}
