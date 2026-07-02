import { useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import { type MessageDescriptor } from '@lingui/core';
import { CheckIcon, ClockIcon, XIcon } from '../../../../components/icons';
import { Badge } from '../../../../components/ui/Badge';
import { Spinner } from '../../../../components/ui/Spinner';
import { ProgressBar } from '../../../../components/ui/ProgressBar';
import { TestRunStatus, TheoryStatus } from '../../../../api/models';
import type { AnyAwaitResult, AwaitKind } from '../../tools/await';
import { RUN_STATUS_VARIANT, THEORY_STATUS_VARIANT } from './badge-variants';
import { groupProgress } from './live-run-progress';
import { runCaseSummary } from './await-card-logic';
import { useAwaitLiveStatus } from './useAwaitLiveStatus';

const THEORY_PHASE_LABEL: Record<TheoryStatus, MessageDescriptor> = {
  [TheoryStatus.Proposed]: msg`Queued`,
  [TheoryStatus.Validating]: msg`A/B testing`,
  [TheoryStatus.Validated]: msg`Improved`,
  [TheoryStatus.Invalidated]: msg`Rejected`,
};

/**
 * One in-flight row of the await card: mirrors the backend's live state for the handle — suite →
 * agent with case progress for a test run, the A/B phase for a theory — instead of a bare id.
 */
export function AwaitPendingRow({ kind, id }: { kind: AwaitKind; id: string }) {
  const { t, i18n } = useLingui();
  const { group, theory } = useAwaitLiveStatus(kind, id, true);

  if (kind === 'test-run') {
    const progress = group ? groupProgress(group) : null;
    return (
      <div className="flex items-center gap-2 text-body-sm">
        <Spinner size={12} className="shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate text-secondary">
          {group ? `${group.suiteName} → ${group.agentName}` : <span className="font-mono text-muted">{id}</span>}
        </span>
        {progress && progress.total > 0 && (
          <span className="flex w-32 shrink-0 items-center gap-1.5">
            <ProgressBar value={progress.completed} max={progress.total || 1} color="var(--accent-primary)" height={4} />
            <span className="shrink-0 font-mono text-caption tabular-nums text-muted">
              {progress.completed}/{progress.total}
            </span>
          </span>
        )}
        <Badge
          label={group ? group.status : t`Starting…`}
          variant={group ? RUN_STATUS_VARIANT[group.status] : 'neutral'}
          size="sm"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-body-sm">
      <Spinner size={12} className="shrink-0 text-teal" />
      <span className="min-w-0 flex-1 truncate text-secondary">
        {theory ? t`Theory · ${theory.agentName}` : <span className="font-mono text-muted">{id}</span>}
      </span>
      <span aria-hidden className="indeterminate-bar h-1 w-32 shrink-0 overflow-hidden rounded-full bg-card-2" />
      <Badge
        label={i18n._(THEORY_PHASE_LABEL[theory?.status ?? TheoryStatus.Proposed])}
        variant={THEORY_STATUS_VARIANT[theory?.status ?? TheoryStatus.Proposed]}
        size="sm"
      />
    </div>
  );
}

/**
 * One settled row of the await card: a semantic outcome icon, what ran, per-case counts for a
 * test run, and the terminal status (or a "Still running" heads-up for a timed-out wait).
 */
export function AwaitResultRow({ item, index }: { item: AnyAwaitResult; index: number }) {
  const { t } = useLingui();
  const cases = item.kind === 'test-run' ? runCaseSummary(item) : null;
  const label = item.kind === 'test-run' ? `${item.suiteName} → ${item.agentName}` : t`Theory · ${item.agentName}`;
  return (
    <div className="fade-up flex items-center gap-2" style={{ animationDelay: `${index * 60}ms` }}>
      <span className="shrink-0"><OutcomeIcon item={item} /></span>
      <span className="min-w-0 flex-1 truncate text-body-sm text-secondary">{label}</span>
      {cases && cases.total > 0 && (
        <span className="shrink-0 font-mono text-caption tabular-nums">
          <span className="text-success">{t`${cases.passed} passed`}</span>
          {cases.failed > 0 && <span className="text-danger"> · {t`${cases.failed} failed`}</span>}
        </span>
      )}
      {item.timedOut ? (
        <Badge label={t`Still running`} variant="warn" size="sm" />
      ) : (
        <Badge
          label={item.status}
          variant={
            item.kind === 'test-run'
              ? RUN_STATUS_VARIANT[item.status as TestRunStatus]
              : THEORY_STATUS_VARIANT[item.status as TheoryStatus]
          }
          size="sm"
        />
      )}
    </div>
  );
}

function OutcomeIcon({ item }: { item: AnyAwaitResult }) {
  if (item.timedOut) return <span className="text-warn"><ClockIcon size={13} /></span>;
  if (item.kind === 'test-run') {
    if (item.status === TestRunStatus.Completed) return <span className="text-success"><CheckIcon size={13} /></span>;
    if (item.status === TestRunStatus.Failed) return <span className="text-danger"><XIcon size={13} /></span>;
    return <span className="text-muted"><ClockIcon size={13} /></span>;
  }
  return item.status === TheoryStatus.Validated ? (
    <span className="text-success"><CheckIcon size={13} /></span>
  ) : (
    <span className="text-muted"><XIcon size={13} /></span>
  );
}
