import { useState, Fragment } from 'react';
import type { TestRunGroupDto, TestRunDto, TestResultDto } from '../../api/models';
import { FOCUS_RING } from '../../lib/constants';
import { fmtDuration } from '../../lib/format';
import { modelColor } from '../../lib/colors';
import { CheckIcon, XIcon } from '../../components/icons';
import { Card } from '../../components/ui/Card';
import { resultPass, resultScore, scoreColor, passRateColor, avgLatency, isDivergent } from './results';
import { SegmentedToggle } from './components/SegmentedToggle';
import { ComparisonDrawer } from './drawers';

interface MatrixCell {
  run: TestRunDto;
  result: TestResultDto | null;
  pass: boolean | null;
  score: number | null;
  idx: number;
}
interface MatrixRow {
  caseId: string;
  summary: string;
  cells: MatrixCell[];
  divergent: boolean;
  failCount: number;
}

/** Cases × models grid, divergence-first. */
export function MatrixView({ group, activeCaseIds, onSelectModel }: {
  group: TestRunGroupDto;
  activeCaseIds?: Set<string>;
  onSelectModel: (runId: string) => void;
}) {
  const runs = group.runs;
  const [divergentOnly, setDivergentOnly] = useState(false);
  const [selectedCase, setSelectedCase] = useState<{ caseId: string; summary: string; focusRunId?: string } | null>(null);

  // Pivot results into a (case × model) grid. testCaseId is shared across runs in a group.
  const caseMap = new Map<string, string>();
  runs.forEach(run => {
    run.testCases.forEach(tc => { if (!caseMap.has(tc.id)) caseMap.set(tc.id, tc.summary); });
    run.results.forEach(r => { if (!caseMap.has(r.testCaseId)) caseMap.set(r.testCaseId, r.testCaseSummary); });
  });

  let rows: MatrixRow[] = [...caseMap.entries()].map(([caseId, summary]) => {
    const cells: MatrixCell[] = runs.map(run => {
      const idx = run.results.findIndex(r => r.testCaseId === caseId);
      const result = idx >= 0 ? run.results[idx] : null;
      return { run, result, pass: result ? resultPass(result) : null, score: result ? resultScore(result) : null, idx };
    });
    const states = cells.flatMap(c => (c.result && c.pass !== null ? [c.pass] : []));
    const divergent = isDivergent(states);
    const failCount = cells.filter(c => c.pass === false).length;
    return { caseId, summary, cells, divergent, failCount };
  });

  const totalCount = rows.length;
  const divergentCount = rows.filter(r => r.divergent).length;
  // Divergence first, then most failures, then alphabetical.
  rows.sort((a, b) => (Number(b.divergent) - Number(a.divergent)) || (b.failCount - a.failCount) || a.summary.localeCompare(b.summary));
  if (divergentOnly) rows = rows.filter(r => r.divergent);

  const gridCols = `minmax(200px,2fr) repeat(${runs.length}, minmax(96px,1fr))`;
  const selIdx = selectedCase ? rows.findIndex(r => r.caseId === selectedCase.caseId) : -1;

  return (
    <Card padding="none">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-2.5 border-b border-hairline">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-h2 font-semibold">Model comparison</span>
          <span className="text-body-sm text-muted">
            {divergentCount > 0
              ? <><span className="text-accent font-semibold">{divergentCount}</span> of {totalCount} cases differ</>
              : `${totalCount} cases — all models agree`}
          </span>
        </div>
        <SegmentedToggle
          value={divergentOnly ? 'divergent' : 'all'}
          onChange={v => setDivergentOnly(v === 'divergent')}
          segments={[{ value: 'all', label: 'All cases' }, { value: 'divergent', label: 'Divergent', count: divergentCount }]}
        />
      </div>

      {/* Matrix */}
      {rows.length === 0 ? (
        <div className="py-[60px] text-center text-muted text-body">No divergent cases — every model returned the same verdict.</div>
      ) : (
        <div className="overflow-auto max-h-[70vh]">
          <div className="grid" style={{ gridTemplateColumns: gridCols }}>
            {/* Header */}
            <div className="sticky top-0 left-0 z-30 bg-card px-4 py-2.5 border-b border-hairline text-title font-semibold text-secondary">Test case</div>
            {runs.map(run => (
              <button
                key={run.id}
                onClick={() => onSelectModel(run.id)}
                title={`Open ${run.endpointName}`}
                className={`sticky top-0 z-20 bg-card px-3 py-2.5 border-b border-hairline flex items-center justify-center gap-1.5 cursor-pointer hover:bg-card-2 transition-colors duration-[var(--motion-fast)] ${FOCUS_RING}`}
              >
                <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: modelColor(run.endpointName) }} />
                <span className="mono text-body-sm font-semibold truncate">{run.endpointName}</span>
              </button>
            ))}

            {/* Rows */}
            {rows.map(row => {
              const rowCls = row.divergent ? 'bg-[color-mix(in_srgb,var(--accent-primary)_5%,transparent)]' : '';
              return (
                <Fragment key={row.caseId}>
                  <button
                    onClick={() => setSelectedCase({ caseId: row.caseId, summary: row.summary })}
                    className={`sticky left-0 z-10 bg-card px-4 py-2.5 border-b border-hairline flex items-center min-w-0 text-left cursor-pointer hover:bg-card-2 transition-colors duration-[var(--motion-fast)] ${FOCUS_RING} ${row.divergent ? 'shadow-[inset_3px_0_0_var(--accent-primary)]' : ''}`}
                    title={`Compare all models — ${row.summary}`}
                  >
                    <span className="truncate text-body">{row.summary}</span>
                  </button>
                  {row.cells.map((cell, ci) => (
                    <div key={ci} className={`border-b border-hairline flex items-stretch ${rowCls}`}>
                      {cell.result ? (
                        <button
                          onClick={() => setSelectedCase({ caseId: row.caseId, summary: row.summary, focusRunId: cell.run.id })}
                          title={`${cell.run.endpointName}: ${cell.pass === true ? 'pass' : cell.pass === false ? 'fail' : 'no result'} — click to compare all models`}
                          className={`w-full px-3 py-2.5 flex items-center justify-center gap-1.5 cursor-pointer hover:bg-card-2 transition-colors duration-[var(--motion-fast)] ${FOCUS_RING}`}
                        >
                          {cell.pass === true ? <CheckIcon size={12} strokeWidth={2.5} className="text-success shrink-0" />
                            : cell.pass === false ? <XIcon size={12} strokeWidth={2.5} className="text-danger shrink-0" /> : null}
                          {cell.score !== null && (
                            <span className="mono text-body-sm font-semibold" style={{ color: scoreColor(cell.score) }}>{cell.score.toFixed(2)}</span>
                          )}
                        </button>
                      ) : (
                        <span className="w-full px-3 py-2.5 flex items-center justify-center text-muted">
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
            <div className="sticky bottom-0 left-0 z-30 bg-card px-4 py-2.5 border-t border-hairline text-body-sm font-semibold text-secondary">Pass rate</div>
            {runs.map(run => {
              const pr = run.totalCases > 0 ? Math.round((run.passedCases / run.totalCases) * 100) : null;
              const avg = avgLatency(run);
              return (
                <div key={run.id} className="sticky bottom-0 z-20 bg-card px-3 py-2 border-t border-hairline flex flex-col items-center justify-center gap-0.5">
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
          onPrev={selIdx > 0 ? () => {
            const prev = rows[selIdx - 1];
            setSelectedCase({ caseId: prev.caseId, summary: prev.summary });
          } : undefined}
          onNext={selIdx < rows.length - 1 ? () => {
            const next = rows[selIdx + 1];
            setSelectedCase({ caseId: next.caseId, summary: next.summary });
          } : undefined}
        />
      )}
    </Card>
  );
}
