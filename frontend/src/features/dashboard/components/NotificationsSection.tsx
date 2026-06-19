import { NotificationStatus } from '../../../api/models';
import { Card } from '../../../components/ui/Card';
import { Skeleton } from '../../../components/ui/Skeleton';
import { BellIcon } from '../../../components/icons';
import { useNotifications, useNotificationMutations } from '../hooks/useNotifications';
import { NotificationRow } from './NotificationRow';

interface NotificationsSectionProps {
  projectId?: string;
  enabled?: boolean;
}

export function NotificationsSection({ projectId, enabled = true }: NotificationsSectionProps) {
  const { data: notifications, isLoading } = useNotifications(projectId, enabled);
  const { markRead, dismiss } = useNotificationMutations();
  const isBusy = markRead.isPending || dismiss.isPending;
  const unreadCount = notifications?.filter((n) => n.status === NotificationStatus.Unread).length ?? 0;

  // Nothing to show and not loading — hide the section entirely rather than render an empty card.
  if (!isLoading && (!notifications || notifications.length === 0)) {
    return null;
  }

  return (
    <Card padding="md" data-testid="notifications-section">
      <Card.Header
        title={
          <span className="flex items-center gap-2">
            <BellIcon size={15} className="text-muted" />
            Notifications
          </span>
        }
        description="Alerts and updates across this project"
        action={
          unreadCount > 0 ? (
            <span
              data-testid="notifications-unread-count"
              className="text-caption font-semibold text-accent-hover tabular-nums"
            >
              {unreadCount} new
            </span>
          ) : undefined
        }
      />
      <Card.Body>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton height={48} />
            <Skeleton height={48} />
          </div>
        ) : (
          <div data-testid="notifications-list" className="max-h-[320px] overflow-y-auto">
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
      </Card.Body>
    </Card>
  );
}
