import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invitesApi, type CreateInviteRequest } from '../../../api/invites';
import { QUERY_KEYS } from '../../../api/query-keys';

/** All invites for the admin table. */
export function useInvites() {
  return useQuery({ queryKey: QUERY_KEYS.invites, queryFn: invitesApi.list });
}

/** Creates an invite; invalidates the list. Caller reads the share URL via `mutate`'s onSuccess. */
export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateInviteRequest) => invitesApi.create(req),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.invites }),
  });
}

/** Revokes an invite by id; invalidates the list. */
export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invitesApi.revoke(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.invites }),
  });
}
