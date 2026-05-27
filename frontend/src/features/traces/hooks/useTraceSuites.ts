import { useQuery } from '@tanstack/react-query';
import { testSuitesApi } from '../../../api/test-suites';
import { QUERY_KEYS } from '../../../api/query-keys';

/**
 * Fetches the test suites available for a trace's agent so the trace detail
 * panel can decide whether "Promote to test case" should be enabled.
 *
 * Gated on `agentId`: when null the query stays disabled and `suites` is empty.
 */
export function useTraceSuites(agentId: string | null) {
  const query = useQuery({
    queryKey: QUERY_KEYS.testSuites(agentId ?? undefined),
    queryFn: () => testSuitesApi.list({ agentId: agentId ?? undefined, pageSize: 200 }),
    enabled: !!agentId,
  });
  return {
    suites: query.data?.items ?? [],
    isLoading: query.isLoading,
  };
}
