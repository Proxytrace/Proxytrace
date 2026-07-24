import { Trans, useLingui } from '@lingui/react/macro';
import type { NotificationDto } from '../../../api/models';
import { EYEBROW_CLS } from '../../../components/ui/classes';
import { fmtDate } from '../../../lib/format';
import useCurrentProject from '../../../hooks/useCurrentProject';
import { kindLabel, statusLabel } from '../notificationsMeta';

/**
 * The notification's own metadata — the fields the popover row has no room for. Rendered as
 * eyebrow/value pairs rather than a hand-rolled `Field` helper (DESIGN.md §2.2: import
 * `EYEBROW_CLS`, don't re-copy the recipe).
 */
export function NotificationFields({ notification }: { notification: NotificationDto }) {
  const { i18n } = useLingui();
  const { projects } = useCurrentProject();
  const project = projects.find(p => p.id === notification.projectId) ?? null;

  return (
    <dl data-testid="notification-fields" className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4">
      <Field label={<Trans>Kind</Trans>} value={i18n._(kindLabel(notification.kind))} />
      <Field label={<Trans>Status</Trans>} value={i18n._(statusLabel(notification.status))} />
      <Field
        label={<Trans>Project</Trans>}
        value={notification.projectId === null
          ? <Trans>All projects</Trans>
          : project?.name ?? <Trans>Unknown project</Trans>}
      />
      <Field label={<Trans>Raised</Trans>} value={fmtDate(notification.createdAt)} />
      <Field label={<Trans>Updated</Trans>} value={fmtDate(notification.updatedAt)} />
    </dl>
  );
}

function Field({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <dt className={EYEBROW_CLS}>{label}</dt>
      <dd className="text-body text-primary break-words">{value}</dd>
    </div>
  );
}
