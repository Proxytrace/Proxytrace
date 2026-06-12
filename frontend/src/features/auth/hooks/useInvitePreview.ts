import { useQuery } from '@tanstack/react-query';
import { localAuthApi } from '../../../auth/local/localAuthApi';
import { QUERY_KEYS } from '../../../api/query-keys';

/** Public invite preview (email + role) for the signup page; errors mean expired/used. */
export function useInvitePreview(token: string) {
  return useQuery({
    queryKey: QUERY_KEYS.invitePreview(token),
    queryFn: () => localAuthApi.fetchInvite(token),
    enabled: !!token,
  });
}
