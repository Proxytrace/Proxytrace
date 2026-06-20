import { useQuery } from '@tanstack/react-query';
import { providersApi } from '../../../api/providers';
import { usersApi } from '../../../api/users';
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

/**
 * The users that an API key can be assigned to as its owner (every MCP call made with the key is
 * attributed to that user). Admin-only data, used by the key-creation form.
 */
export function useUsersList() {
  return useQuery({
    queryKey: QUERY_KEYS.users,
    queryFn: () => usersApi.list({ pageSize: 200 }),
    select: r => r.items,
  });
}
