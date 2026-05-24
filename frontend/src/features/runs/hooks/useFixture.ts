import { useQuery } from '@tanstack/react-query';
import { testRunsApi } from '../../../api/test-runs';
import { QUERY_KEYS } from '../../../api/query-keys';

/** Single-case fixture (input, expected/actual output, evaluations, runtime, cost) for one run. */
export function useFixture(runId: string, caseId: string) {
  const query = useQuery({
    queryKey: QUERY_KEYS.fixture(runId, caseId),
    queryFn: () => testRunsApi.getFixture(runId, caseId),
  });
  return { fixture: query.data, isLoading: query.isLoading };
}
