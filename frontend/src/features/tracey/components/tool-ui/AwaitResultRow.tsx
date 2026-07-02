import { useLingui } from '@lingui/react/macro';
import { CheckIcon, ClockIcon, XIcon } from '../../../../components/icons';
import { Badge } from '../../../../components/ui/Badge';
import { TestRunStatus, TheoryStatus } from '../../../../api/models';
import type { AnyAwaitResult } from '../../tools/await';
import { RUN_STATUS_LABEL, RUN_STATUS_VARIANT, THEORY_STATUS_LABEL, THEORY_STATUS_VARIANT } from './badge-variants';
import { entityLabel, runCaseSummary } from './await-card-logic';

/**
 * One settled row of the await card: a semantic outcome icon, what ran, per-case counts for a
 * test run, and the terminal status (or a "Still running" heads-up for a timed-out wait).
 * `delayIndex` staggers the entrance alongside its sibling rows.
 */
export function AwaitResultRow({ item, delayIndex }: { item: AnyAwaitResult; delayIndex: number }) {
  const { t, i18n } = useLingui();
  const cases = item.kind === 'test-run' ? runCaseSummary(item) : null;
  const label =
    item.kind === 'test-run'
      ? (entityLabel(item) ?? t`Test run`)
      : item.agentName
        ? t`Theory · ${item.agentName}`
        : t`Theory`;
  return (
    <div
      className="fade-up flex items-center gap-2"
      style={{ animationDelay: `${delayIndex * 60}ms` }}
      data-testid={`tracey-await-row-${item.id}`}
    >
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
      ) : item.kind === 'test-run' ? (
        <Badge label={i18n._(RUN_STATUS_LABEL[item.status])} variant={RUN_STATUS_VARIANT[item.status]} size="sm" />
      ) : (
        <Badge label={i18n._(THEORY_STATUS_LABEL[item.status])} variant={THEORY_STATUS_VARIANT[item.status]} size="sm" />
      )}
    </div>
  );
}

function OutcomeIcon({ item }: { item: AnyAwaitResult }) {
  if (item.timedOut) return <span className="text-warn"><ClockIcon size={13} /></span>;
  if (item.kind === 'test-run') {
    if (item.status === TestRunStatus.Completed) return <span className="text-success"><CheckIcon size={13} /></span>;
    if (item.status === TestRunStatus.Failed) return <span className="text-danger"><XIcon size={13} /></span>;
    return <span className="text-muted"><XIcon size={13} /></span>;
  }
  return item.status === TheoryStatus.Validated ? (
    <span className="text-success"><CheckIcon size={13} /></span>
  ) : (
    <span className="text-muted"><XIcon size={13} /></span>
  );
}
