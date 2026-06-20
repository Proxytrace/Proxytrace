import { Trans, useLingui } from '@lingui/react/macro';
import { Pill } from '../../../components/ui/Pill';
import { RowButton } from '../../../components/ui/RowButton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { fmtDateTime } from '../../../lib/format';
import type { AuditLogEntryDto } from '../../../api/models';
import { AUDIT_ACTION_LABEL, AUDIT_ACTOR_TYPE_LABEL, ACTION_COLOR } from '../auditLogMeta';

interface AuditLogTableProps {
  entries: AuditLogEntryDto[];
  selectedId: string | null;
  onSelect: (entry: AuditLogEntryDto) => void;
  isFetching: boolean;
}

export function AuditLogTable({ entries, selectedId, onSelect, isFetching }: AuditLogTableProps) {
  const { t, i18n } = useLingui();
  if (entries.length === 0) {
    return (
      <EmptyState
        title={t`No audit events`}
        description={t`Security and lifecycle events will appear here as they occur.`}
      />
    );
  }

  return (
    <div
      data-testid="audit-log-table"
      className={`flex flex-col ${isFetching ? 'opacity-60 transition-opacity' : ''}`}
    >
      <div className="grid grid-cols-[180px_1fr_160px_190px] gap-3 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted border-b border-hairline">
        <span><Trans>Action</Trans></span>
        <span><Trans>Actor</Trans></span>
        <span><Trans>Target</Trans></span>
        <span className="text-right"><Trans>When</Trans></span>
      </div>
      {entries.map(entry => (
        <RowButton
          key={entry.id}
          data-testid={`audit-log-row-${entry.id}`}
          onClick={() => onSelect(entry)}
          className={`grid grid-cols-[180px_1fr_160px_190px] gap-3 px-3 py-2.5 items-center border-b border-hairline transition-colors ${
            entry.id === selectedId ? 'bg-accent-subtle' : 'hover:bg-card-2'
          }`}
        >
          <span>
            <Pill
              label={i18n._(AUDIT_ACTION_LABEL[entry.action])}
              color={ACTION_COLOR[entry.action]}
              size="sm"
            />
          </span>
          <span className="min-w-0 truncate text-[13px] text-primary font-medium">
            {entry.actorEmail ?? i18n._(AUDIT_ACTOR_TYPE_LABEL[entry.actorType])}
          </span>
          <span className="min-w-0 truncate text-xs text-muted" title={entry.targetLabel ?? entry.targetType}>
            {entry.targetType}{entry.targetLabel ? ` · ${entry.targetLabel}` : ''}
          </span>
          <span className="text-right text-xs text-muted font-mono whitespace-nowrap tabular-nums">
            {fmtDateTime(entry.createdAt)}
          </span>
        </RowButton>
      ))}
    </div>
  );
}
