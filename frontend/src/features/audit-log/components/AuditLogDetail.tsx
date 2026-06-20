import { Trans, useLingui } from '@lingui/react/macro';
import { Drawer } from '../../../components/overlays/Drawer';
import { Pill } from '../../../components/ui/Pill';
import { CodeBlock } from '../../../components/ui/CodeBlock';
import { fmtDate } from '../../../lib/format';
import type { AuditLogEntryDto } from '../../../api/models';
import { AuditOutcome } from '../../../api/models';
import { AUDIT_ACTION_LABEL, AUDIT_ACTOR_TYPE_LABEL, AUDIT_OUTCOME_LABEL, ACTION_COLOR } from '../auditLogMeta';

interface AuditLogDetailProps {
  entry: AuditLogEntryDto;
  onClose: () => void;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</div>
      <div className="text-[13px] text-primary font-mono break-words">{value}</div>
    </div>
  );
}

export function AuditLogDetail({ entry, onClose }: AuditLogDetailProps) {
  const { t, i18n } = useLingui();
  const actionLabel = i18n._(AUDIT_ACTION_LABEL[entry.action]);
  return (
    <Drawer title={actionLabel} subtitle={fmtDate(entry.createdAt)} onClose={onClose}>
      <div data-testid="audit-log-detail" className="flex items-center gap-2 flex-wrap">
        <Pill label={actionLabel} color={ACTION_COLOR[entry.action]} size="md" />
        <Pill
          label={i18n._(AUDIT_OUTCOME_LABEL[entry.outcome])}
          color={entry.outcome === AuditOutcome.Success ? 'var(--success)' : 'var(--danger)'}
          size="md"
        />
      </div>

      <Field label={t`Actor type`} value={i18n._(AUDIT_ACTOR_TYPE_LABEL[entry.actorType])} />
      {entry.actorEmail && <Field label={t`Actor email`} value={entry.actorEmail} />}
      {entry.actorUserId && <Field label={t`Actor user ID`} value={entry.actorUserId} />}
      {entry.actorApiKeyId && <Field label={t`Actor API key ID`} value={entry.actorApiKeyId} />}
      {entry.projectId && <Field label={t`Project ID`} value={entry.projectId} />}

      <Field label={t`Target type`} value={entry.targetType} />
      {entry.targetLabel && <Field label={t`Target`} value={entry.targetLabel} />}
      {entry.targetId && <Field label={t`Target ID`} value={entry.targetId} />}

      {entry.details ? (
        <CodeBlock heading={t`Details`} content={entry.details} maxLines={20} />
      ) : (
        <div className="text-[13px] text-muted"><Trans>No additional details for this event.</Trans></div>
      )}
    </Drawer>
  );
}
