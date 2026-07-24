import { Trans, useLingui } from '@lingui/react/macro';
import { Drawer } from '../../../components/overlays/Drawer';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { XIcon } from '../../../components/icons';
import { fmtDate } from '../../../lib/format';
import { NotificationStatus, type NotificationDto } from '../../../api/models';
import { severityBadgeVariant, severityLabel } from '../notificationsMeta';
import { NotificationFields } from './NotificationFields';
import { NotificationTargetPreview } from './target-previews/NotificationTargetPreview';

interface NotificationDetailDrawerProps {
  notification: NotificationDto;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onDismiss: (id: string) => void;
}

/**
 * Right-side detail for one notification. The notification *is* the record — for an anomaly there
 * is no other entity — so this shows the whole thing (untruncated message, metadata) rather than
 * sending the user off to whatever page the target happens to live on. The target is summarised
 * inline instead, and tolerates having been deleted.
 */
export function NotificationDetailDrawer({
  notification,
  onClose,
  onPrev,
  onNext,
  onDismiss,
}: NotificationDetailDrawerProps) {
  const { t, i18n } = useLingui();
  const isDismissed = notification.status === NotificationStatus.Dismissed;

  return (
    <Drawer
      title={notification.title}
      subtitle={fmtDate(notification.createdAt)}
      onClose={onClose}
      onPrev={onPrev}
      onNext={onNext}
      actions={
        !isDismissed && (
          <Button
            variant="secondary"
            size="sm"
            data-write
            data-testid="notification-detail-dismiss-btn"
            leftIcon={<XIcon size={13} />}
            onClick={() => onDismiss(notification.id)}
          >
            <Trans>Dismiss</Trans>
          </Button>
        )
      }
    >
      <div data-testid="notification-detail" className="flex flex-col gap-5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            label={i18n._(severityLabel(notification.severity))}
            variant={severityBadgeVariant(notification.severity)}
            size="md"
          />
          {isDismissed && <Badge label={t`Dismissed`} variant="neutral" size="md" />}
        </div>

        <p
          data-testid="notification-detail-message"
          className="text-body text-secondary leading-relaxed whitespace-pre-wrap break-words"
        >
          {notification.message}
        </p>

        <NotificationFields notification={notification} />

        <NotificationTargetPreview targetKind={notification.targetKind} targetId={notification.targetId} />
      </div>
    </Drawer>
  );
}
