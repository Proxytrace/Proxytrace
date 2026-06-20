import { Link } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import type { NotificationDto } from '../../../api/models';
import { NotificationStatus } from '../../../api/models';
import { Badge } from '../../../components/ui/Badge';
import { Button, IconButton } from '../../../components/ui/Button';
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
  const { t, i18n } = useLingui();
  const { id, title, message, severity, status, createdAt, targetKind, targetId } = notification;
  const route = targetRoute(targetKind, targetId);
  const isUnread = status === NotificationStatus.Unread;

  return (
    <div
      data-testid={`notification-row-${id}`}
      className={cn(
        'group flex items-start gap-2.5 px-3.5 py-2.5 border-b border-border-subtle last:border-b-0',
        isUnread && 'bg-[color-mix(in_srgb,var(--accent-primary)_4%,transparent)]',
      )}
    >
      <span
        aria-hidden
        className={cn('mt-[5px] size-1.5 rounded-full shrink-0', isUnread ? 'bg-accent' : 'bg-transparent')}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Badge label={i18n._(severityLabel(severity))} variant={severityBadgeVariant(severity)} size="sm" />
          <span data-testid={`notification-title-${id}`} className="text-body-sm font-semibold text-primary truncate">
            {title}
          </span>
          <span className="text-caption text-muted shrink-0 ml-auto tabular-nums">{fmtRelative(createdAt)}</span>
        </div>
        <p className="text-body-sm text-muted leading-snug mt-0.5 line-clamp-2">{message}</p>
        {route && (
          <Button asChild variant="link" className="mt-1.5 px-0 text-body-sm">
            <Link to={route} data-testid={`notification-link-${id}`} className="inline-flex items-center gap-1">
              <Trans>View details</Trans>
              <ExternalLinkIcon size={11} />
            </Link>
          </Button>
        )}
      </div>

      <div className="flex items-center gap-0.5 shrink-0 -mr-1.5 opacity-70 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {isUnread && (
          <IconButton
            size="sm"
            aria-label={t`Mark as read`}
            data-testid={`notification-read-btn-${id}`}
            disabled={isBusy}
            onClick={() => onMarkRead(id)}
          >
            <CheckIcon size={14} />
          </IconButton>
        )}
        <IconButton
          size="sm"
          aria-label={t`Dismiss`}
          data-testid={`notification-dismiss-btn-${id}`}
          disabled={isBusy}
          onClick={() => onDismiss(id)}
        >
          <XIcon size={14} />
        </IconButton>
      </div>
    </div>
  );
}
