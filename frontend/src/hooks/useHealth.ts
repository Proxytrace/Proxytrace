import { useQuery } from '@tanstack/react-query';
import { checkHealth } from '../api/health';
import { QUERY_KEYS } from '../api/query-keys';

/**
 * Polls the backend health endpoint every 10s via TanStack Query.
 * Returns `true` (online), `false` (offline), or `undefined` (still connecting).
 */
export function useHealth() {
  return useQuery({
    queryKey: QUERY_KEYS.health,
    queryFn: ({ signal }) => checkHealth(signal),
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
  });
}
