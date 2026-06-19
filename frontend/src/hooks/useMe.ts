import { useQuery } from '@tanstack/react-query'
import { meApi } from '../api/me'
import { QUERY_KEYS } from '../api/query-keys'

/**
 * The current authenticated user (id, email, role, UI language) from GET /api/auth/me.
 * Mode-agnostic: the cookie (local) or bearer token (OIDC) authenticates the call. Pass
 * `enabled: false` where there is no real session (e.g. kiosk) so it doesn't 401.
 */
export function useMe(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: QUERY_KEYS.me,
    queryFn: () => meApi.get(),
    enabled: opts?.enabled ?? true,
    retry: false,
    // A 401 here just means "no session yet" — never surface it as a page error.
    throwOnError: false,
    staleTime: Infinity,
  })
}
