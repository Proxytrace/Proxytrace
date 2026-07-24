import { Trans } from '@lingui/react/macro';
import type { NotificationDto } from '../../../api/models';
import { Skeleton } from '../../../components/ui/Skeleton';
import { BellIcon } from '../../../components/icons';
import { NotificationRow } from './NotificationRow';

interface NotificationsPanelProps {
  notifications: NotificationDto[];
  isLoading: boolean;
  unreadCount: number;
  /** Id of the row whose mutation is in flight, if any — only that row's actions are disabled. */
  pendingId: string | null;
  onOpen: (id: string) => void;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
}

/** The bell popover's contents: header + unread count, then the rows, loading or empty state. */
export function NotificationsPanel({
  notifications,
  isLoading,
  unreadCount,
  pendingId,
  onOpen,
  onMarkRead,
  onDismiss,
}: NotificationsPanelProps) {
  const isEmpty = !isLoading && notifications.length === 0;

  return (
    <div data-testid="notifications-panel" className="flex flex-col max-h-[440px]">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-border-subtle shrink-0">
        <span className="text-title font-semibold text-primary"><Trans>Notifications</Trans></span>
        {unreadCount > 0 && (
          <span
            data-testid="notifications-unread-count"
            className="text-caption font-semibold text-accent-hover tabular-nums"
          >
            <Trans>{unreadCount} new</Trans>
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
          <span className="text-body-sm font-semibold text-primary"><Trans>No notifications</Trans></span>
          <span className="text-body-sm text-muted">
            <Trans>Anomalies and alerts from your test runs will appear here.</Trans>
          </span>
        </div>
      ) : (
        <div data-testid="notifications-list" className="overflow-y-auto">
          {notifications.map(n => (
            <NotificationRow
              key={n.id}
              notification={n}
              onOpen={onOpen}
              onMarkRead={onMarkRead}
              onDismiss={onDismiss}
              isPending={pendingId === n.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
