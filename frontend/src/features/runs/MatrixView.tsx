import { useState, useMemo, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import type { TestRunGroupDto } from '../../api/models';
import { FOCUS_RING } from '../../lib/constants';
import { cn } from '../../lib/cn';
import { fmtDuration } from '../../lib/format';
import { Card } from '../../components/ui/Card';
import { passRateColor, passRatePercent, avgLatency, buildMatrixRows, isActive } from './results';
import type { LiveProgress } from './live';
import { matrixCounts, filterSortMatrixRows, type MatrixFilter, type MatrixSort } from './comparison';
import { ModelTag } from './components/ModelTag';
import { MatrixCellContent } from './components/MatrixCell';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { RowButton } from '../../components/ui/RowButton';
import { ComparisonDrawer } from './drawers';

/** Cases × models grid, divergence-first. Live progress overlays in-flight cases during a run. */
export function MatrixView({ group, live }: {
  group: TestRunGroupDto;
  live?: LiveProgress;
}) {
  const { t } = useLingui();
  const runs = group.runs;
  const [searchParams, setSearchParams] = useSearchParams();
  // eslint-disable-next-line lingui/no-unlocalized-strings -- URL query-param key
  const caseParam = searchParams.get('case');
  // eslint-disable-next-line lingui/no-unlocalized-strings -- filter state token, not UI copy
  const [filter, setFilter] = useState<MatrixFilter>('all');
  // eslint-disable-next-line lingui/no-unlocalized-strings -- sort state token, not UI copy
  const [sort, setSort] = useState<MatrixSort>('order');
  const [selectedCase, setSelectedCase] = useState<{ caseId: string; summary: string; focusRunId?: string } | null>(null);

  // Freeze row order while any run is in flight so rows don't reshuffle on every partial verdict.
  const active = runs.some(r => isActive(r.status));
  const allRows = useMemo(() => buildMatrixRows(runs, live), [runs, live]);

  // Deep link (?case=) opens the drawer for one case. Derived from the URL (no effect) so it
  // appears as soon as the row loads; local selection takes precedence once the user clicks.
  const urlCase = useMemo(() => {
    if (!caseParam) return null;
    const row = allRows.find(r => r.caseId === caseParam);
    return row ? { caseId: row.caseId, summary: row.summary, focusRunId: undefined as string | undefined } : null;
  }, [caseParam, allRows]);
  const openCase = selectedCase ?? urlCase;

  const clearCaseParam = () => setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    // eslint-disable-next-line lingui/no-unlocalized-strings -- URL query-param key
    next.delete('case');
    return next;
  }, { replace: true });
  const closeDrawer = () => { setSelectedCase(null); if (caseParam) clearCaseParam(); };
  const counts = matrixCounts(allRows);
  const rows = useMemo(() => filterSortMatrixRows(allRows, filter, sort, active), [allRows, filter, sort, active]);

  const multi = runs.length > 1;
  const gridCols = cn(`minmax(240px,2.2fr) 72px repeat(${runs.length}, minmax(150px,1fr))`);
  const selIdx = openCase ? rows.findIndex(r => r.caseId === openCase.caseId) : -1;

  return (
    <Card padding="none" data-testid="matrix-view" className="flex flex-col flex-1 min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-2.5 border-b border-hairline">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-h2 font-semibold"><Trans>Test case matrix</Trans></span>
          <span className="text-body-sm text-muted">
            {multi
              ? <Trans>{counts.all} cases × {runs.length} models — divergent rows striped</Trans>
              : <Trans>{counts.all} cases × 1 model</Trans>}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <SegmentedControl
            value={filter}
            onChange={setFilter}
            segments={[
              { value: 'all', label: t`All`, count: counts.all },
              ...(multi ? [{ value: 'divergent' as const, label: t`Divergent`, count: counts.divergent }] : []),
              { value: 'failing', label: t`Failing`, count: counts.failing },
              { value: 'passing', label: t`Passing`, count: counts.passing },
            ]}
          />
          <SegmentedControl
            value={sort}
            onChange={setSort}
            segments={[{ value: 'order', label: t`Order` }, { value: 'worst', label: t`Worst` }]}
          />
        </div>
      </div>

      {/* Matrix */}
      {rows.length === 0 ? (
        <div className="py-[60px] text-center text-muted text-body"><Trans>No cases match this filter.</Trans></div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="grid min-w-max" style={{ gridTemplateColumns: gridCols }}>
            {/* Header */}
            <div className="sticky top-0 z-20 bg-card px-4 py-2.5 border-b border-hairline text-caption font-semibold text-muted uppercase tracking-[0.06em]"><Trans>Test case</Trans></div>
            <div className="sticky top-0 z-20 bg-card px-3 py-2.5 border-b border-hairline text-caption font-semibold text-muted uppercase tracking-[0.06em] text-right"><Trans>Lat</Trans></div>
            {runs.map(run => (
              <div key={run.id} data-testid={`matrix-col-${run.endpointId}`} className="sticky top-0 z-20 bg-card px-3 py-2.5 border-b border-hairline flex items-center">
                <ModelTag name={run.endpointName} size="xs" />
              </div>
            ))}

            {/* Rows */}
            {rows.map((row, ri) => {
              const withResult = row.cells.filter(c => c.result);
              const passes = withResult.filter(c => c.pass === true).length;
              const total = withResult.length;
              const isSelected = openCase?.caseId === row.caseId;
              const stripe = row.divergent ? cn('shadow-[inset_3px_0_0_var(--warn)]') : '';
              const selBg = isSelected ? cn('bg-[color-mix(in_srgb,var(--accent-primary)_7%,transparent)]') : '';
              const avg = row.cells.map(c => c.result?.durationMs).filter((d): d is number => d != null);
              const avgMs = avg.length ? avg.reduce((a, b) => a + b, 0) / avg.length : null;

              return (
                <Fragment key={row.caseId}>
                  {/* Full-width row separator */}
                  {ri > 0 && <div aria-hidden className="h-px bg-hairline col-span-full" />}

                  {/* Test case + verdict / divergence indicator */}
                  <RowButton
                    onClick={() => setSelectedCase({ caseId: row.caseId, summary: row.summary })}
                    data-testid={`matrix-row-${row.caseId}`}
                    className={cn('px-4 py-2.5 flex items-center gap-2.5 min-w-0 hover:bg-card-2 transition-colors duration-[var(--motion-fast)]', stripe, selBg, FOCUS_RING)}
                    title={t`Compare all models — ${row.summary}`}
                  >
                    {multi ? (
                      <span className={cn('mono text-caption font-bold px-1 py-0.5 rounded-sm shrink-0', divChipClass(row.divergent, passes, total))}>{passes}/{total}</span>
                    ) : (
                      <span className={cn('w-2 h-2 rounded-full shrink-0', verdictDotClass(withResult[0]?.pass))} />
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

                  {/* Per-model cells */}
                  {row.cells.map((cell, ci) => (
                    <div key={ci} className={cn('flex items-stretch', selBg)}>
                      <MatrixCellContent
                        cell={cell}
                        onCompare={runId => setSelectedCase({ caseId: row.caseId, summary: row.summary, focusRunId: runId })}
                      />
                    </div>
                  ))}
                </Fragment>
              );
            })}

            {/* Footer: pass rate + avg latency per model */}
            <div className="sticky bottom-0 z-20 bg-card px-4 py-2.5 border-t border-hairline text-body-sm font-semibold text-secondary"><Trans>Pass rate</Trans></div>
            <div className="sticky bottom-0 z-20 bg-card border-t border-hairline" />
            {runs.map(run => {
              const pr = passRatePercent(run.passedCases, run.passedCases + run.failedCases);
              const avg = avgLatency(run);
              return (
                <div key={run.id} className="sticky bottom-0 z-20 bg-card px-3 py-2 border-t border-hairline flex flex-col items-start justify-center gap-0.5">
                  <span className="mono text-title font-bold" style={{ color: active ? 'var(--text-muted)' : passRateColor(pr) }}>{pr !== null ? `${pr}%` : '—'}</span>
                  <span className="mono text-caption text-muted">{avg !== null ? `~${fmtDuration(avg)}` : '—'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {openCase && selIdx >= 0 && (
        <ComparisonDrawer
          runs={runs}
          caseId={openCase.caseId}
          caseSummary={openCase.summary}
          caseIdx={selIdx}
          total={rows.length}
          focusRunId={openCase.focusRunId}
          onClose={closeDrawer}
          onPrev={selIdx > 0 ? () => { const p = rows[selIdx - 1]; setSelectedCase({ caseId: p.caseId, summary: p.summary }); } : undefined}
          onNext={selIdx < rows.length - 1 ? () => { const n = rows[selIdx + 1]; setSelectedCase({ caseId: n.caseId, summary: n.summary }); } : undefined}
        />
      )}
    </Card>
  );
}

function verdictDotClass(pass: boolean | null | undefined): string {
  return pass === true ? cn('bg-success') : pass === false ? cn('bg-danger') : cn('bg-[var(--text-muted)]');
}

function divChipClass(divergent: boolean, passes: number, total: number): string {
  if (divergent) return cn('bg-[color-mix(in_srgb,var(--warn)_18%,transparent)] text-warn');
  if (passes === total) return cn('text-muted');
  return cn('bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] text-danger');
}
