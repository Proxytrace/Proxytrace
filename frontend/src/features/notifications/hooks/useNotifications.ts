import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../../../api/notifications';
import { QUERY_KEYS } from '../../../api/query-keys';

/** Non-dismissed notifications for the current project scope (newest first). */
export function useNotifications(projectId?: string, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.notifications(projectId),
    queryFn: () => notificationsApi.list({ projectId, includeRead: true }),
    enabled,
  });
}

/** Mark-read / dismiss mutations. Both invalidate the notifications cache on success. */
export function useNotificationMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: QUERY_KEYS.notificationsRoot });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: invalidate,
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => notificationsApi.dismiss(id),
    onSuccess: invalidate,
  });

  return { markRead, dismiss };
}
