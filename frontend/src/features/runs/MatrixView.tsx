import { useState, useMemo, Fragment } from 'react';
import type { TestRunGroupDto, EvaluationResultDto } from '../../api/models';
import { FOCUS_RING } from '../../lib/constants';
import { cn } from '../../lib/cn';
import { fmtDuration } from '../../lib/format';
import { CheckIcon, XIcon } from '../../components/icons';
import { Card } from '../../components/ui/Card';
import { passRateColor, passRatePercent, avgLatency, buildMatrixRows, isErrored, isEvalPass } from './results';
import { matrixCounts, filterSortMatrixRows, type MatrixFilter, type MatrixSort } from './comparison';
import { ModelTag } from './components/ModelTag';
import { SegmentedToggle } from './components/SegmentedToggle';
import { ComparisonDrawer } from './drawers';

/** Cases × models grid, divergence-first. */
export function MatrixView({ group, activeCaseIds }: {
  group: TestRunGroupDto;
  activeCaseIds?: Set<string>;
}) {
  const runs = group.runs;
  const [filter, setFilter] = useState<MatrixFilter>('all');
  const [sort, setSort] = useState<MatrixSort>('order');
  const [selectedCase, setSelectedCase] = useState<{ caseId: string; summary: string; focusRunId?: string } | null>(null);

  const allRows = useMemo(() => buildMatrixRows(runs), [runs]);
  const counts = matrixCounts(allRows);
  const rows = useMemo(() => filterSortMatrixRows(allRows, filter, sort), [allRows, filter, sort]);

  const multi = runs.length > 1;
  const gridCols = `minmax(240px,2.2fr) 72px repeat(${runs.length}, minmax(150px,1fr))`;
  const selIdx = selectedCase ? rows.findIndex(r => r.caseId === selectedCase.caseId) : -1;

  return (
    <Card padding="none">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-2.5 border-b border-hairline">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-h2 font-semibold">Test case matrix</span>
          <span className="text-body-sm text-muted">
            {multi
              ? <>{counts.all} cases × {runs.length} models — divergent rows striped</>
              : `${counts.all} cases × 1 model`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <SegmentedToggle
            value={filter}
            onChange={setFilter}
            segments={[
              { value: 'all', label: 'All', count: counts.all },
              ...(multi ? [{ value: 'divergent' as const, label: 'Divergent', count: counts.divergent }] : []),
              { value: 'failing', label: 'Failing', count: counts.failing },
              { value: 'passing', label: 'Passing', count: counts.passing },
            ]}
          />
          <SegmentedToggle
            value={sort}
            onChange={setSort}
            segments={[{ value: 'order', label: 'Order' }, { value: 'worst', label: 'Worst' }]}
          />
        </div>
      </div>

      {/* Matrix */}
      {rows.length === 0 ? (
        <div className="py-[60px] text-center text-muted text-body">No cases match this filter.</div>
      ) : (
        <div className="overflow-auto max-h-[70vh]">
          <div className="grid min-w-max" style={{ gridTemplateColumns: gridCols }}>
            {/* Header */}
            <div className="sticky top-0 z-20 bg-card px-4 py-2.5 border-b border-hairline text-caption font-semibold text-muted uppercase tracking-[0.06em]">Test case</div>
            <div className="sticky top-0 z-20 bg-card px-3 py-2.5 border-b border-hairline text-caption font-semibold text-muted uppercase tracking-[0.06em] text-right">Lat</div>
            {runs.map(run => (
              <div key={run.id} className="sticky top-0 z-20 bg-card px-3 py-2.5 border-b border-hairline flex items-center">
                <ModelTag name={run.endpointName} size="xs" />
              </div>
            ))}

            {/* Rows */}
            {rows.map((row, ri) => {
              const withResult = row.cells.filter(c => c.result);
              const passes = withResult.filter(c => c.pass === true).length;
              const total = withResult.length;
              const isSelected = selectedCase?.caseId === row.caseId;
              const stripe = row.divergent ? 'shadow-[inset_3px_0_0_var(--warn)]' : '';
              const selBg = isSelected ? 'bg-[color-mix(in_srgb,var(--accent-primary)_7%,transparent)]' : '';
              const avg = row.cells.map(c => c.result?.durationMs).filter((d): d is number => d != null);
              const avgMs = avg.length ? avg.reduce((a, b) => a + b, 0) / avg.length : null;

              return (
                <Fragment key={row.caseId}>
                  {/* Full-width row separator */}
                  {ri > 0 && <div aria-hidden className="h-px bg-hairline" style={{ gridColumn: '1 / -1' }} />}

                  {/* Test case + verdict / divergence indicator */}
                  <button
                    onClick={() => setSelectedCase({ caseId: row.caseId, summary: row.summary })}
                    className={cn('px-4 py-2.5 flex items-center gap-2.5 min-w-0 text-left cursor-pointer hover:bg-card-2 transition-colors duration-[var(--motion-fast)]', stripe, selBg, FOCUS_RING)}
                    title={`Compare all models — ${row.summary}`}
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
                  </button>

                  {/* Avg latency */}
                  <div className={cn('px-3 py-2.5 flex items-center justify-end', selBg)}>
                    <span className="mono text-caption text-muted">{avgMs !== null ? fmtDuration(avgMs) : '—'}</span>
                  </div>

                  {/* Per-model cells */}
                  {row.cells.map((cell, ci) => (
                    <div key={ci} className={cn('flex items-stretch', selBg)}>
                      {cell.result ? (
                        <button
                          onClick={() => setSelectedCase({ caseId: row.caseId, summary: row.summary, focusRunId: cell.run.id })}
                          title={`${cell.run.endpointName}: ${cell.pass === true ? 'pass' : cell.pass === false ? 'fail' : 'no verdict'} — click to compare`}
                          className={cn('w-full px-3 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-card-2 transition-colors duration-[var(--motion-fast)]', FOCUS_RING)}
                        >
                          {cell.pass === true ? <CheckIcon size={12} strokeWidth={2.5} className="text-success shrink-0" />
                            : cell.pass === false ? <XIcon size={12} strokeWidth={2.5} className="text-danger shrink-0" /> : null}
                          <EvalDots evaluations={cell.result.evaluations} />
                          <span className="mono text-caption text-muted shrink-0">{fmtDuration(cell.result.durationMs)}</span>
                        </button>
                      ) : (
                        <span className="w-full px-3 py-2.5 flex items-center text-muted">
                          {activeCaseIds?.has(row.caseId)
                            ? <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-accent inline-block" />
                            : '—'}
                        </span>
                      )}
                    </div>
                  ))}
                </Fragment>
              );
            })}

            {/* Footer: pass rate + avg latency per model */}
            <div className="sticky bottom-0 z-20 bg-card px-4 py-2.5 border-t border-hairline text-body-sm font-semibold text-secondary">Pass rate</div>
            <div className="sticky bottom-0 z-20 bg-card border-t border-hairline" />
            {runs.map(run => {
              const pr = passRatePercent(run.passedCases, run.passedCases + run.failedCases);
              const avg = avgLatency(run);
              return (
                <div key={run.id} className="sticky bottom-0 z-20 bg-card px-3 py-2 border-t border-hairline flex flex-col items-start justify-center gap-0.5">
                  <span className="mono text-title font-bold" style={{ color: passRateColor(pr) }}>{pr !== null ? `${pr}%` : '—'}</span>
                  <span className="mono text-caption text-muted">{avg !== null ? `~${fmtDuration(avg)}` : '—'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedCase && selIdx >= 0 && (
        <ComparisonDrawer
          runs={runs}
          caseId={selectedCase.caseId}
          caseSummary={selectedCase.summary}
          caseIdx={selIdx}
          total={rows.length}
          focusRunId={selectedCase.focusRunId}
          onClose={() => setSelectedCase(null)}
          onPrev={selIdx > 0 ? () => { const p = rows[selIdx - 1]; setSelectedCase({ caseId: p.caseId, summary: p.summary }); } : undefined}
          onNext={selIdx < rows.length - 1 ? () => { const n = rows[selIdx + 1]; setSelectedCase({ caseId: n.caseId, summary: n.summary }); } : undefined}
        />
      )}
    </Card>
  );
}

/** One dot per evaluator (left→right = suite order), colored pass/fail/error. */
function EvalDots({ evaluations }: { evaluations: EvaluationResultDto[] }) {
  return (
    <span className="flex items-center gap-1">
      {evaluations.map((e, i) => (
        <span
          key={i}
          title={`${e.evaluatorName}: ${isErrored(e) ? 'error' : isEvalPass(e) ? 'pass' : 'fail'}`}
          className={cn('w-2 h-2 rounded-full shrink-0', isErrored(e) ? 'bg-warn' : isEvalPass(e) ? 'bg-success' : 'bg-danger')}
        />
      ))}
    </span>
  );
}

function verdictDotClass(pass: boolean | null | undefined): string {
  return pass === true ? 'bg-success' : pass === false ? 'bg-danger' : 'bg-[var(--text-muted)]';
}

function divChipClass(divergent: boolean, passes: number, total: number): string {
  if (divergent) return 'bg-[color-mix(in_srgb,var(--warn)_18%,transparent)] text-warn';
  if (passes === total) return 'text-muted';
  return 'bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] text-danger';
}
