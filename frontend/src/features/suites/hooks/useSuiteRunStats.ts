import { useQuery } from '@tanstack/react-query';
import { testSuitesApi } from '../../../api/test-suites';
import { QUERY_KEYS } from '../../../api/query-keys';
import type { SuiteWindow } from '../suiteWindow';

/** Bucket-windowed run stats for a suite. Disabled until a suite id is known. */
export function useSuiteRunStats(suiteId: string, window: SuiteWindow) {
  const query = useQuery({
    queryKey: QUERY_KEYS.testSuiteRunStats(suiteId, window.from, window.to),
    queryFn: () => testSuitesApi.runStats(suiteId, { from: window.from, to: window.to }),
    enabled: !!suiteId,
  });
  return { stats: query.data, isLoading: query.isLoading };
}
