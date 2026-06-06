import { useQueries } from '@tanstack/react-query';
import { testRunsApi } from '../../../api/test-runs';
import { QUERY_KEYS } from '../../../api/query-keys';
import type { TestRunDto } from '../../../api/models';

/**
 * Fetches the same case's fixture across every run in a group — one query per run, in run order.
 *
 * A run may legitimately lack a result for the case (e.g. the case was added to the suite after
 * the run executed), which the API answers with a 404. That is an expected "not run" state, not a
 * failure, so these queries opt out of the global `throwOnError`/retry — the column renders empty
 * instead of crashing the drawer via the error boundary.
 */
export function useComparisonFixtures(runs: TestRunDto[], caseId: string) {
  return useQueries({
    queries: runs.map(run => ({
      queryKey: QUERY_KEYS.fixture(run.id, caseId),
      queryFn: () => testRunsApi.getFixture(run.id, caseId),
      throwOnError: false,
      retry: false,
    })),
  });
}
