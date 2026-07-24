import { useLingui } from '@lingui/react/macro';
import type { NotificationDto } from '../../../api/models';
import { NotificationStatus } from '../../../api/models';
import { Badge } from '../../../components/ui/Badge';
import { IconButton } from '../../../components/ui/Button';
import { RowButton } from '../../../components/ui/RowButton';
import { CheckIcon, XIcon } from '../../../components/icons';
import { cn } from '../../../lib/cn';
import { fmtRelative } from '../../../lib/format';
import { severityBadgeVariant, severityLabel } from '../notificationsMeta';

interface NotificationRowProps {
  notification: NotificationDto;
  onOpen: (id: string) => void;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  /** True while this row's own mutation is in flight — never disables the other rows. */
  isPending: boolean;
}

export function NotificationRow({ notification, onOpen, onMarkRead, onDismiss, isPending }: NotificationRowProps) {
  const { t, i18n } = useLingui();
  const { id, title, message, severity, status, createdAt } = notification;
  const isUnread = status === NotificationStatus.Unread;

  return (
    // The row-wide open target and the per-row actions are siblings, not nested — a button inside
    // a button is invalid markup and unreachable by keyboard.
    <div
      className={cn(
        'group relative border-b border-border-subtle last:border-b-0',
        isUnread && 'bg-[color-mix(in_srgb,var(--accent-primary)_4%,transparent)]',
      )}
    >
      <RowButton
        data-testid={`notification-row-${id}`}
        aria-label={t`Open notification: ${title}`}
        onClick={() => onOpen(id)}
        className="flex items-start gap-2.5 px-3.5 py-2.5 pr-14 hover:bg-[var(--bg-wash-hover)]"
      >
        <span
          aria-hidden
          className={cn('mt-1 size-1.5 rounded-full shrink-0', isUnread ? 'bg-accent' : 'bg-transparent')}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Badge label={i18n._(severityLabel(severity))} variant={severityBadgeVariant(severity)} size="sm" />
            <span
              data-testid={`notification-title-${id}`}
              className="min-w-0 text-body-sm font-semibold text-primary truncate"
            >
              {title}
            </span>
            <span className="text-caption text-muted shrink-0 ml-auto tabular-nums">{fmtRelative(createdAt)}</span>
          </div>
          <p className="text-body-sm text-muted leading-snug mt-0.5 line-clamp-2">{message}</p>
        </div>
      </RowButton>

      <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {isUnread && (
          <IconButton
            size="sm"
            aria-label={t`Mark as read`}
            data-testid={`notification-read-btn-${id}`}
            data-write
            disabled={isPending}
            onClick={() => onMarkRead(id)}
          >
            <CheckIcon size={14} />
          </IconButton>
        )}
        <IconButton
          size="sm"
          aria-label={t`Dismiss`}
          data-testid={`notification-dismiss-btn-${id}`}
          data-write
          disabled={isPending}
          onClick={() => onDismiss(id)}
        >
          <XIcon size={14} />
        </IconButton>
      </div>
    </div>
  );
}
