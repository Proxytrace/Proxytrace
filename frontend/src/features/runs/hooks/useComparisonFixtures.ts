import { useQueries } from '@tanstack/react-query';
import { testRunsApi } from '../../../api/test-runs';
import { QUERY_KEYS } from '../../../api/query-keys';
import type { TestRunDto } from '../../../api/models';

/** Fetches the same case's fixture across every run in a group — one query per run, in run order. */
export function useComparisonFixtures(runs: TestRunDto[], caseId: string) {
  return useQueries({
    queries: runs.map(run => ({
      queryKey: QUERY_KEYS.fixture(run.id, caseId),
      queryFn: () => testRunsApi.getFixture(run.id, caseId),
    })),
  });
}
