import { useEffect, useRef } from 'react';
import { NotificationStatus, type NotificationDto } from '../../../api/models';
import { useKiosk } from '../../../contexts/KioskContext';

/**
 * Opening a notification marks it read. A `?notification=` deep link opens the drawer on cold load
 * with no click to hang this off, so it can't be an event handler — it synchronizes server state
 * with URL-driven state, which is what an effect is for (BEST_PRACTICES §4.1). Kept in its own
 * hook rather than inline in the menu.
 *
 * The ref guards the round-trip: the mutation invalidates the list, the notification arrives again
 * still `Unread` for one render, and without it that would fire a second request.
 *
 * A read-only kiosk is skipped entirely. Its `[data-write]` kill-switch is CSS over write
 * *controls*, which a programmatic write like this one slips straight past — the demo backend then
 * 403s and the visitor gets a red error toast just for reading a notification.
 */
export function useMarkReadOnOpen(
  notification: NotificationDto | null,
  markRead: (id: string) => void,
) {
  const { enabled: kiosk, interactive } = useKiosk();
  const isReadOnly = kiosk && !interactive;
  const markedId = useRef<string | null>(null);

  useEffect(() => {
    if (isReadOnly) return;
    if (!notification || notification.status !== NotificationStatus.Unread) return;
    if (markedId.current === notification.id) return;
    markedId.current = notification.id;
    markRead(notification.id);
  }, [notification, markRead, isReadOnly]);
}
