import { Fragment } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { TestRunDto } from '../../../api/models';
import { FOCUS_RING } from '../../../lib/constants';
import { cn } from '../../../lib/cn';
import { fmtDuration } from '../../../lib/format';
import { passRateColor } from '../../../lib/runResults';
import { cohortPassRate, type Cohort, type CohortRow, type CohortVerdict } from '../cohorts';
import { ModelTag } from './ModelTag';
import { MatrixCohortCell } from './MatrixCell';
import { RowButton } from '../../../components/ui/RowButton';

/** The case a click in the grid selects: identity for the drawer, plus an optional endpoint to focus. */
export interface MatrixSelection {
  caseId: string;
  summary: string;
  focusEndpointId?: string;
}

interface MatrixGridProps {
  cohorts: Cohort<TestRunDto>[];
  /** Rows already filtered + sorted by the container. */
  rows: CohortRow[];
  /** Unfiltered rows — the per-endpoint footer pass rate is computed across all cases. */
  allRows: CohortRow[];
  /** A run is still in flight — footer pass rates render muted until the group settles. */
  active: boolean;
  selectedCaseId: string | null;
  onSelectCase: (sel: MatrixSelection) => void;
}

/** Presentational (case × endpoint) grid: sticky header of endpoints, one row per case with a
 *  verdict/divergence indicator + avg latency + per-cohort cells, and a sticky pass-rate footer. */
export function MatrixGrid({ cohorts, rows, allRows, active, selectedCaseId, onSelectCase }: MatrixGridProps) {
  const { t } = useLingui();
  const multi = cohorts.length > 1;
  const gridCols = cn(`minmax(240px,2.2fr) 72px repeat(${cohorts.length}, minmax(150px,1fr))`);

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-max" style={{ gridTemplateColumns: gridCols }}>
        {/* Header */}
        <div className="sticky top-0 z-20 bg-card px-4 py-2.5 border-b border-hairline text-caption font-semibold text-muted uppercase tracking-[0.06em]"><Trans>Test case</Trans></div>
        <div className="sticky top-0 z-20 bg-card px-3 py-2.5 border-b border-hairline text-caption font-semibold text-muted uppercase tracking-[0.06em] text-right"><Trans>Lat</Trans></div>
        {cohorts.map(cohort => (
          <div key={cohort.endpointId} data-testid={`matrix-col-${cohort.endpointId}`} className="sticky top-0 z-20 bg-card px-3 py-2.5 border-b border-hairline flex items-center gap-1.5">
            <ModelTag name={cohort.endpointName} size="xs" />
            {cohort.sampleCount > 1 && (
              <span className="mono px-1 py-px rounded-sm text-caption font-semibold bg-white/[0.06] text-muted shrink-0">×{cohort.sampleCount}</span>
            )}
          </div>
        ))}

        {/* Rows */}
        {rows.map((row, ri) => {
          const judged = row.cells.filter(c => c.verdict !== null);
          const passes = judged.filter(c => c.verdict === 'pass').length;
          const total = judged.length;
          const isSelected = selectedCaseId === row.caseId;
          const stripe = row.divergent ? cn('shadow-[inset_3px_0_0_var(--warn)]') : '';
          const selBg = isSelected ? cn('bg-[color-mix(in_srgb,var(--accent-primary)_7%,transparent)]') : '';
          const durations = row.cells.flatMap(c => c.samples).map(s => s.result?.durationMs).filter((d): d is number => d != null);
          const avgMs = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

          return (
            <Fragment key={row.caseId}>
              {/* Full-width row separator */}
              {ri > 0 && <div aria-hidden className="h-px bg-hairline col-span-full" />}

              {/* Test case + verdict / divergence indicator */}
              <RowButton
                onClick={() => onSelectCase({ caseId: row.caseId, summary: row.summary })}
                data-testid={`matrix-row-${row.caseId}`}
                className={cn('px-4 py-2.5 flex items-center gap-2.5 min-w-0 hover:bg-card-2 transition-colors duration-[var(--motion-fast)]', stripe, selBg, FOCUS_RING)}
                title={t`Compare all models — ${row.summary}`}
              >
                {multi ? (
                  <span className={cn('mono text-caption font-bold px-1 py-0.5 rounded-sm shrink-0', divChipClass(row.divergent, passes, total))}>{passes}/{total}</span>
                ) : (
                  <span className={cn('w-2 h-2 rounded-full shrink-0', verdictDotClass(row.cells[0]?.verdict))} />
                )}
                <span className="flex flex-col min-w-0">
                  <span className="truncate text-body">{row.summary}</span>
                  <span className="mono text-caption text-muted truncate">{row.caseId.slice(0, 8)}</span>
                </span>
              </RowButton>

              {/* Avg latency */}
              <div className={cn('px-3 py-2.5 flex items-center justify-end', selBg)}>
                <span className="mono text-caption text-muted">{avgMs !== null ? fmtDuration(avgMs) : '—'}</span>
              </div>

              {/* Per-endpoint cohort cells */}
              {row.cells.map((cell, ci) => (
                <div key={ci} className={cn('flex items-stretch', selBg)}>
                  <MatrixCohortCell
                    cell={cell}
                    onCompare={endpointId => onSelectCase({ caseId: row.caseId, summary: row.summary, focusEndpointId: endpointId })}
                  />
                </div>
              ))}
            </Fragment>
          );
        })}

        {/* Footer: pass rate + avg latency per endpoint */}
        <div className="sticky bottom-0 z-20 bg-card px-4 py-2.5 border-t border-hairline text-body-sm font-semibold text-secondary"><Trans>Pass rate</Trans></div>
        <div className="sticky bottom-0 z-20 bg-card border-t border-hairline" />
        {cohorts.map((cohort, i) => {
          const pr = cohortPassRate(allRows, i);
          const latencies = cohort.runs.flatMap(r => r.results.map(res => res.durationMs));
          const avg = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null;
          return (
            <div key={cohort.endpointId} className="sticky bottom-0 z-20 bg-card px-3 py-2 border-t border-hairline flex flex-col items-start justify-center gap-0.5">
              <span className="mono text-title font-bold" style={{ color: active ? 'var(--text-muted)' : passRateColor(pr) }}>{pr !== null ? `${pr}%` : '—'}</span>
              <span className="mono text-caption text-muted">{avg !== null ? `~${fmtDuration(avg)}` : '—'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function verdictDotClass(verdict: CohortVerdict | undefined): string {
  return verdict === 'pass' ? cn('bg-success')
    : verdict === 'fail' ? cn('bg-danger')
      : verdict === 'mixed' ? cn('bg-warn')
        : cn('bg-[var(--text-muted)]');
}

function divChipClass(divergent: boolean, passes: number, total: number): string {
  if (divergent) return cn('bg-[color-mix(in_srgb,var(--warn)_18%,transparent)] text-warn');
  if (passes === total) return cn('text-muted');
  return cn('bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] text-danger');
}
