import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Popover } from '../../components/ui/Popover';
import { IconButton } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { BellIcon } from '../../components/icons';
import { useNotificationStream } from '../../api/event-stream';
import { QUERY_KEYS } from '../../api/query-keys';
import { NotificationStatus } from '../../api/models';
import useCurrentProject from '../../hooks/useCurrentProject';
import { useNotifications, useNotificationMutations } from './hooks/useNotifications';
import { NotificationRow } from './components/NotificationRow';

/**
 * Top-bar notifications inbox: a bell `IconButton` with an unread badge that opens a
 * GitHub-style popover panel. Mounted once in the `Shell` topbar so the badge and live
 * updates apply on every page, not just the dashboard.
 */
export function NotificationsMenu() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;
  const enabled = currentProjectId !== null;

  const { data: notifications, isLoading } = useNotifications(projectId, enabled);
  const { markRead, dismiss } = useNotificationMutations();
  const isBusy = markRead.isPending || dismiss.isPending;

  // Live updates app-wide — refresh the cache on any notification SSE event for this project.
  useNotificationStream(projectId, () => {
    qc.invalidateQueries({ queryKey: QUERY_KEYS.notificationsRoot });
  });

  const unreadCount = notifications?.filter((n) => n.status === NotificationStatus.Unread).length ?? 0;
  const hasUnread = unreadCount > 0;
  const isEmpty = !isLoading && (!notifications || notifications.length === 0);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      className="w-[380px]"
      trigger={
        <IconButton
          data-testid="notifications-menu-trigger"
          aria-label={hasUnread ? `Notifications (${unreadCount} unread)` : 'Notifications'}
          className="relative"
        >
          <BellIcon size={16} />
          {hasUnread && (
            <span
              data-testid="notifications-unread-badge"
              aria-hidden
              className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 inline-flex items-center justify-center rounded-full bg-accent text-accent-ink text-[9px] font-bold leading-none tabular-nums shadow-[var(--shadow-pill)]"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </IconButton>
      }
    >
      <div data-testid="notifications-panel" className="flex flex-col max-h-[440px]">
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-border-subtle shrink-0">
          <span className="text-title font-semibold text-primary">Notifications</span>
          {hasUnread && (
            <span
              data-testid="notifications-unread-count"
              className="text-caption font-semibold text-accent-hover tabular-nums"
            >
              {unreadCount} new
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2 p-3.5">
            <Skeleton height={52} />
            <Skeleton height={52} />
            <Skeleton height={52} />
          </div>
        ) : isEmpty ? (
          <div
            data-testid="notifications-empty-state"
            className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center"
          >
            <BellIcon size={22} className="text-muted" />
            <span className="text-body-sm font-semibold text-primary">No notifications</span>
            <span className="text-body-sm text-muted">
              Anomalies and alerts from your test runs will appear here.
            </span>
          </div>
        ) : (
          <div data-testid="notifications-list" className="overflow-y-auto">
            {notifications?.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                onMarkRead={markRead.mutate}
                onDismiss={dismiss.mutate}
                isBusy={isBusy}
              />
            ))}
          </div>
        )}
      </div>
    </Popover>
  );
}
