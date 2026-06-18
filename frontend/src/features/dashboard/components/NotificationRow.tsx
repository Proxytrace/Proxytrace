import { Link } from 'react-router-dom';
import type { NotificationDto } from '../../../api/models';
import { NotificationStatus } from '../../../api/models';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { CheckIcon, ExternalLinkIcon, XIcon } from '../../../components/icons';
import { cn } from '../../../lib/cn';
import { fmtRelative } from '../../../lib/format';
import { severityBadgeVariant, severityLabel, targetRoute } from '../notificationsMeta';

interface NotificationRowProps {
  notification: NotificationDto;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  isBusy: boolean;
}

export function NotificationRow({ notification, onMarkRead, onDismiss, isBusy }: NotificationRowProps) {
  const { id, title, message, severity, status, createdAt, targetKind, targetId } = notification;
  const route = targetRoute(targetKind, targetId);
  const isUnread = status === NotificationStatus.Unread;

  return (
    <div
      data-testid={`notification-row-${id}`}
      className={cn(
        'flex items-start gap-3 py-2.5 border-b border-hairline last:border-b-0',
        isUnread && 'bg-[color-mix(in_srgb,var(--accent-primary)_5%,transparent)]',
      )}
    >
      <span
        aria-hidden
        className={cn('mt-1.5 size-1.5 rounded-full shrink-0', isUnread ? 'bg-accent' : 'bg-transparent')}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge label={severityLabel(severity)} variant={severityBadgeVariant(severity)} size="sm" />
          <span data-testid={`notification-title-${id}`} className="text-body-sm font-semibold text-primary truncate">
            {title}
          </span>
          <span className="text-caption text-muted shrink-0 ml-auto tabular-nums">{fmtRelative(createdAt)}</span>
        </div>
        <p className="text-body-sm text-muted mt-0.5 line-clamp-2">{message}</p>
        {route && (
          <Button asChild variant="link" size="sm" className="mt-1 px-0">
            <Link to={route} data-testid={`notification-link-${id}`} className="inline-flex items-center gap-1">
              View details
              <ExternalLinkIcon size={12} />
            </Link>
          </Button>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {isUnread && (
          <Button
            variant="ghost"
            size="sm"
            aria-label="Mark as read"
            data-testid={`notification-read-btn-${id}`}
            disabled={isBusy}
            onClick={() => onMarkRead(id)}
            leftIcon={<CheckIcon size={14} />}
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          aria-label="Dismiss"
          data-testid={`notification-dismiss-btn-${id}`}
          disabled={isBusy}
          onClick={() => onDismiss(id)}
          leftIcon={<XIcon size={14} />}
        />
      </div>
    </div>
  );
}
