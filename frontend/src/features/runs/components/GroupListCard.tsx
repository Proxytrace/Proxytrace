import { Trans, useLingui } from '@lingui/react/macro';
import type { TestRunGroupListItemDto, TestRunSummaryDto } from '../../../api/models';
import { cn } from '../../../lib/cn';
import { FOCUS_RING } from '../../../lib/constants';
import { fmtRelative } from '../../../lib/format';
import { agentColor, modelColor } from '../../../lib/colors';
import { selectionRowStyle, SELECTION_ROW_INACTIVE } from '../../../lib/selectionRow';
import { TrashIcon, TargetIcon } from '../../../components/icons';
import { Pill } from '../../../components/ui/Pill';
import { IconButton } from '../../../components/ui/Button';
import { RowButton } from '../../../components/ui/RowButton';
import { isActive, passRateColor, passRatePercent } from '../results';
import { buildCohorts, type Cohort } from '../cohorts';

/** Card in the left-hand run-group list. Identical layout for single- and multi-model groups. */
export function GroupListCard({ group, isSelected, onSelect, onDelete }: {
  group: TestRunGroupListItemDto;
  isSelected: boolean;
  onSelect: () => void;
  /** Omit to render the card read-only (no delete affordance) — e.g. a suite's run history. */
  onDelete?: () => void;
}) {
  const { t } = useLingui();
  const c = agentColor(group.agentId);
  const cohorts = buildCohorts(group.runs);
  const endpointCount = cohorts.length;
  // A group is "live" while it (or any of its runs) is still pending/running — the card gets an
  // animated accent ring + a pulsing "Running" tag so in-flight runs stand out in the rail.
  const running = isActive(group.status) || group.runs.some(r => isActive(r.status));

  return (
    // Wrapper is a positioning + hover context so the delete control is a real
    // sibling button, not nested inside the card button (invalid HTML / a11y).
    <div className="group/card relative" data-testid={`group-list-card-${group.id}`}>
      <RowButton
        onClick={onSelect}
        aria-pressed={isSelected}
        data-testid={`group-list-card-btn-${group.id}`}
        className={cn(
          'relative rounded-lg overflow-hidden pl-4 pr-3.5 py-3 transition-[box-shadow,background-color] duration-[var(--motion-base)]',
          FOCUS_RING,
          isSelected ? '' : SELECTION_ROW_INACTIVE,
          running && 'streaming-border',
        )}
        style={isSelected ? selectionRowStyle(c) : undefined}
      >
        <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg" style={{ background: c }} />

        <div className="flex items-center gap-1.5 mb-2 pr-6 min-w-0">
          <span className="truncate text-title font-semibold leading-none">{group.suiteName}</span>
          {running && (
            <span
              data-testid={`group-list-card-running-${group.id}`}
              className="inline-flex items-center gap-1 text-caption text-accent font-semibold shrink-0"
            >
              <span aria-hidden className="pulse-dot w-[5px] h-[5px] rounded-full bg-accent inline-block" />
              <Trans>Running</Trans>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mb-2.5 min-w-0">
          <Pill label={group.agentName} color={c} />
          {group.isSystemRun && (
            <span className="mono px-1.5 py-px rounded-sm text-caption font-semibold bg-accent-subtle text-accent shrink-0"><Trans>A/B</Trans></span>
          )}
          {endpointCount > 1 && (
            <span className="mono px-1.5 py-px rounded-sm text-caption font-semibold bg-white/[0.06] text-muted shrink-0"><Trans>{endpointCount} models</Trans></span>
          )}
          {group.sampleCount > 1 && (
            <span className="mono px-1.5 py-px rounded-sm text-caption font-semibold bg-white/[0.06] text-muted shrink-0">×{group.sampleCount}</span>
          )}
          <span className="text-caption text-muted ml-auto shrink-0">{fmtRelative(group.createdAt)}</span>
        </div>

        <ModelStack cohorts={cohorts} />
      </RowButton>

      {onDelete && (
        <IconButton
          danger
          onClick={onDelete}
          className={`absolute top-2.5 right-2.5 opacity-0 transition-opacity duration-[var(--motion-fast)] group-hover/card:opacity-100 focus-visible:opacity-100 ${FOCUS_RING}`}
          aria-label={t`Delete run group`}
        >
          <TrashIcon size={13} />
        </IconButton>
      )}
    </div>
  );
}

/** Mean judged pass rate across a cohort's samples (0..100), or null when none judged. */
function cohortMeanRate(cohort: Cohort<TestRunSummaryDto>): number | null {
  const rates = cohort.runs
    .map(r => passRatePercent(r.passedCases, r.passedCases + r.failedCases))
    .filter((x): x is number => x !== null);
  return rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null;
}

/** Per-endpoint pass-rate stack — one row per endpoint cohort (its samples averaged). */
function ModelStack({ cohorts }: { cohorts: Cohort<TestRunSummaryDto>[] }) {
  const rates = cohorts.map(cohortMeanRate);
  const best = Math.max(...rates.map(r => r ?? -1));
  const showWinner = cohorts.length > 1;

  return (
    <div className="flex flex-col gap-1">
      {cohorts.map((cohort, i) => {
        const pr = rates[i];
        const prc = passRateColor(pr);
        const mc = modelColor(cohort.endpointName);
        const winner = showWinner && pr !== null && pr === best;
        return (
          <div key={cohort.endpointId} className="grid grid-cols-[84px_1fr_auto] gap-2 items-center">
            <span className="mono text-caption flex items-center gap-1 min-w-0" style={{ color: mc }}>
              <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ background: mc }} />
              <span className="truncate">{cohort.endpointName}</span>
            </span>
            <span className="h-[5px] rounded-full bg-white/[0.06] overflow-hidden">
              <span className="block h-full rounded-full" style={{ width: `${pr ?? 0}%`, background: prc }} />
            </span>
            <span className="mono text-caption font-bold flex items-center gap-1 justify-end min-w-[34px]" style={{ color: prc }}>
              {pr === null ? '—' : `${pr}%`}
              {winner && <TargetIcon size={9} className="text-accent" />}
            </span>
          </div>
        );
      })}
    </div>
  );
}
