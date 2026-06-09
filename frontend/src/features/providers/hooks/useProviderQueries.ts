import { useQuery } from '@tanstack/react-query';
import { providersApi } from '../../../api/providers';
import { QUERY_KEYS } from '../../../api/query-keys';

/**
 * The whole Providers page in one request: every provider with its models and keys embedded,
 * plus the projects available for scoping keys. Selecting a provider needs no further fetch;
 * mutations invalidate this query to refresh.
 */
export function useProvidersOverview() {
  return useQuery({
    queryKey: QUERY_KEYS.providersOverview,
    queryFn: providersApi.overview,
  });
}
