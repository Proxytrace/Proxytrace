import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { testRunGroupsApi } from '../../api/test-run-groups';
import { agentsApi } from '../../api/agents';
import { QUERY_KEYS } from '../../api/query-keys';
import { useCurrentProject } from '../../contexts/ProjectContext';
import { TestRunStatus, EvaluatorKind, EvaluationScore, EvaluationStatus, type EvaluationResultDto, type TestRunDto, type TestRunGroupDto, type TestResultDto, type TestRunEvent } from '../../api/models';

const PASSING_SCORES = new Set<EvaluationScore>([EvaluationScore.Acceptable, EvaluationScore.Good, EvaluationScore.Excellent]);
const isPass = (e: EvaluationResultDto) =>
  e.status === EvaluationStatus.Succeeded && e.score !== null && PASSING_SCORES.has(e.score);
const isErrored = (e: EvaluationResultDto) => e.status === EvaluationStatus.Errored;
import { GridIcon, TableIcon, TrashIcon } from '../../components/icons';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { useTestRunGroupStream } from '../../api/event-stream';
import { agentColor, modelColor, EVALUATOR_KIND_COLOR } from '../../lib/colors';
import { fmtDuration, fmtRelative } from '../../lib/format';
import { ColoredBadge } from '../../components/ui/ColoredBadge';
import { FilterDropdown } from '../../components/ui/FilterDropdown';
import { DataTable } from '../../components/ui/DataTable';
import type { DataColumn } from '../../components/ui/DataTable';
import { FixtureDrawer } from './FixtureDrawer';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonList } from '../../components/ui/Skeleton';
import { PASS_RATE_WARN, PASS_RATE_DANGER, SCORE_WARN, SCORE_DANGER, REFETCH_INTERVAL_LIVE, LIST_PAGE_SIZE } from '../../lib/constants';

type CaseFilter = 'all' | 'passed' | 'failed';
type ViewMode = 'table' | 'grid';

// ─── helpers ─────────────────────────────────────────────────────────────────

function statusColor(s: TestRunStatus) {
  if (s === TestRunStatus.Completed) return 'var(--success)';
  if (s === TestRunStatus.Running) return 'var(--accent-primary)';
  if (s === TestRunStatus.Failed) return 'var(--danger)';
  if (s === TestRunStatus.Cancelled) return 'var(--text-muted)';
  return 'var(--text-muted)';
}

function isActive(s: TestRunStatus) {
  return s === TestRunStatus.Running || s === TestRunStatus.Pending;
}

function passColorOf(rate: number) {
  return rate >= PASS_RATE_WARN ? 'var(--success)' : rate >= PASS_RATE_DANGER ? 'var(--warn)' : 'var(--danger)';
}

function resultPass(r: TestResultDto): boolean | null {
  if (r.evaluations.length === 0) return null;
  return r.evaluations.every(e => isPass(e));
}

function resultScore(r: TestResultDto): number | null {
  const succeeded = r.evaluations.filter(e => e.status === EvaluationStatus.Succeeded);
  if (succeeded.length === 0) return null;
  const passed = succeeded.filter(e => isPass(e)).length;
  return passed / succeeded.length;
}

function avgLatency(run: TestRunDto): number | null {
  if (run.results.length === 0) return null;
  return run.results.reduce((s, r) => s + r.durationMs, 0) / run.results.length;
}

// ─── Minimap (case squares) ──────────────────────────────────────────────────

function Minimap({
  run, activeCaseIds, selectedCaseId, onPick, size = 18,
}: {
  run: TestRunDto;
  activeCaseIds?: Set<string>;
  selectedCaseId?: string | null;
  onPick?: (r: TestResultDto, idx: number) => void;
  size?: number;
}) {
  const completedIds = new Set(run.results.map(r => r.testCaseId));
  const pending = run.testCases.filter(tc => !completedIds.has(tc.id));

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
      {run.results.map((r, i) => {
        const pass = resultPass(r);
        const selected = selectedCaseId === r.testCaseId;
        const fill = pass === true ? 'rgba(16,185,129,0.28)' : pass === false ? 'rgba(239,68,68,0.28)' : 'rgba(255,255,255,0.07)';
        const border = selected ? '#fff' : pass === true ? 'rgba(16,185,129,0.55)' : pass === false ? 'rgba(239,68,68,0.55)' : 'var(--border-color)';
        return (
          <button
            key={r.id}
            onClick={onPick ? () => onPick(r, i) : undefined}
            title={r.testCaseSummary}
            style={{
              width: size, height: size, borderRadius: 4, flexShrink: 0,
              background: fill, border: `1.5px solid ${border}`,
              cursor: onPick ? 'pointer' : 'default',
              transition: 'transform 0.1s',
            }}
            onMouseEnter={e => onPick && (e.currentTarget.style.transform = 'scale(1.2)')}
            onMouseLeave={e => onPick && (e.currentTarget.style.transform = 'scale(1)')}
          />
        );
      })}
      {pending.map(tc => {
        const running = activeCaseIds?.has(tc.id) ?? false;
        return (
          <span
            key={tc.id}
            title={`${tc.summary} — ${running ? 'running…' : 'pending'}`}
            className={running ? 'pulse-dot' : undefined}
            style={{
              width: size, height: size, borderRadius: 4, flexShrink: 0,
              background: running ? 'rgba(201,148,74,0.18)' : 'transparent',
              border: `1.5px dashed ${running ? 'rgba(201,148,74,0.55)' : 'var(--hairline)'}`,
            }}
          />
        );
      })}
    </div>
  );
}

// ─── CaseCard (grid view, failure-first) ─────────────────────────────────────

function CaseCard({ r, isSelected, onClick }: { r: TestResultDto; isSelected: boolean; onClick: () => void }) {
  const pass = resultPass(r);
  const score = resultScore(r);
  const scoreColor = score === null ? 'var(--text-muted)' : score >= SCORE_WARN ? 'var(--success)' : score >= SCORE_DANGER ? 'var(--warn)' : 'var(--danger)';
  const erroredFirst = r.evaluations.find(e => isErrored(e));
  const reasoning = erroredFirst
    ? erroredFirst.errorMessage
    : r.evaluations.find(e => !isPass(e) && e.reasoning)?.reasoning;
  const tint = pass === false
    ? (isSelected ? 'rgba(239,68,68,0.10)' : 'rgba(239,68,68,0.05)')
    : (isSelected ? 'rgba(201,148,74,0.06)' : 'var(--bg-card-2)');
  const borderColor = isSelected
    ? (pass === false ? 'rgba(239,68,68,0.45)' : 'rgba(201,148,74,0.35)')
    : pass === false ? 'color-mix(in srgb, var(--danger) 28%, transparent)' : 'var(--hairline)';

  return (
    <button
      onClick={onClick}
      className="cursor-pointer"
      style={{
        textAlign: 'left', padding: '12px 14px', width: '100%',
        background: tint,
        border: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${scoreColor}`,
        borderRadius: 'var(--radius-md)',
        display: 'flex', flexDirection: 'column', gap: 6,
        transition: 'background 0.1s, border-color 0.1s',
        overflow: 'hidden', position: 'relative',
      }}
    >
      {/* Top: case id + score (only when imperfect) + latency */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-[6px] min-w-0">
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: pass === true ? 'var(--success)' : pass === false ? 'var(--danger)' : 'var(--text-muted)', flexShrink: 0 }} />
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.testCaseId.slice(0, 7)}</span>
          {score !== null && score < 1 && (
            <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: scoreColor }}>{score.toFixed(2)}</span>
          )}
        </div>
        <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', flexShrink: 0 }}>{fmtDuration(r.durationMs)}</span>
      </div>

      {/* Headline */}
      <div
        className="overflow-hidden"
        style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
      >
        {r.testCaseSummary}
      </div>

      {/* Failure reasoning excerpt */}
      {pass === false && reasoning && (
        <div
          className="overflow-hidden"
          style={{ fontSize: 11, color: 'var(--danger)', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
        >
          {reasoning}
        </div>
      )}

      {/* Evaluator pills */}
      {r.evaluations.length > 0 && (
        <div className="flex flex-wrap gap-[4px]">
          {r.evaluations.map((e, i) => {
            const c = EVALUATOR_KIND_COLOR[e.evaluatorKind as EvaluatorKind] ?? 'var(--text-muted)';
            const errored = isErrored(e);
            const evalPass = isPass(e);
            const accent = errored ? 'var(--warn)' : (evalPass ? c : 'var(--danger)');
            const bg = errored
              ? 'color-mix(in srgb, var(--warn) 18%, transparent)'
              : evalPass
                ? `color-mix(in srgb, ${c} 14%, transparent)`
                : 'color-mix(in srgb, var(--danger) 18%, transparent)';
            const title = errored
              ? `${e.evaluatorName}: error — ${e.errorMessage ?? ''}`
              : `${e.evaluatorName}: ${e.score}`;
            const label = errored ? `${e.evaluatorName} · error` : e.evaluatorName;
            return (
              <span
                key={i}
                title={title}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 7px', borderRadius: 100,
                  background: bg,
                  color: accent,
                  fontSize: 10, fontWeight: 600,
                  opacity: errored ? 1 : evalPass ? 0.85 : 1,
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: accent }} />
                {label}
              </span>
            );
          })}
        </div>
      )}
    </button>
  );
}

// ─── EndpointCompareCard ─────────────────────────────────────────────────────

function EndpointCompareCard({
  run, isSelected, onSelect, activeCaseIds,
}: {
  run: TestRunDto;
  isSelected: boolean;
  onSelect: () => void;
  activeCaseIds?: Set<string>;
}) {
  const mc = modelColor(run.endpointName);
  const passRate = run.totalCases > 0 ? Math.round((run.passedCases / run.totalCases) * 100) : null;
  const pc = passRate !== null ? passColorOf(passRate) : 'var(--text-muted)';
  const active = isActive(run.status);
  const avg = avgLatency(run);

  return (
    <button
      onClick={onSelect}
      className="cursor-pointer text-left flex flex-col gap-[10px] overflow-hidden"
      style={{
        flex: '1 1 220px', minWidth: 220,
        padding: '12px 14px',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: `1.5px solid ${isSelected ? mc : 'transparent'}`,
        boxShadow: isSelected ? `0 0 0 3px color-mix(in srgb, ${mc} 14%, transparent), var(--shadow-card)` : 'var(--shadow-card)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      {/* Row 1: model + status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-[6px] min-w-0">
          <span style={{ width: 8, height: 8, borderRadius: 2, background: mc, flexShrink: 0 }} />
          <span className="mono overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: 12, fontWeight: 600 }}>
            {run.endpointName}
          </span>
        </div>
        {active && (
          <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0 }} />
        )}
      </div>

      {/* Row 2: pass rate big + counts + avg latency */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-[6px]">
          <span className="mono" style={{ fontSize: 22, fontWeight: 700, color: pc, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {passRate !== null ? `${passRate}%` : '—'}
          </span>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
            {run.passedCases}/{run.totalCases}
          </span>
        </div>
        {avg !== null && (
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
            ~{fmtDuration(avg)}
          </span>
        )}
      </div>

      {/* Row 3: mini minimap */}
      <Minimap run={run} activeCaseIds={activeCaseIds} size={10} />
    </button>
  );
}

// ─── RunDetail ───────────────────────────────────────────────────────────────

function RunDetail({ run, activeCaseIds }: { run: TestRunDto; activeCaseIds?: Set<string> }) {
  const [selectedCase, setSelectedCase] = useState<{ runId: string; caseId: string; summary: string; idx: number } | null>(null);

  const passed = run.results.filter(r => resultPass(r) === true).length;
  const failed = run.results.filter(r => resultPass(r) === false).length;
  const passRate = run.totalCases > 0 ? Math.round((run.passedCases / run.totalCases) * 100) : 0;
  const pc = passColorOf(passRate);
  const active = isActive(run.status);
  const avg = avgLatency(run);

  // Initial filter: "failed" if any failures, else "all". Component is keyed on run.id
  // so this re-initialises whenever the user switches endpoint.
  const [caseFilter, setCaseFilter] = useState<CaseFilter>(() => (failed > 0 ? 'failed' : 'all'));
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const filteredResults = run.results.filter(r => {
    if (caseFilter === 'all') return true;
    const pass = resultPass(r);
    if (caseFilter === 'passed') return pass === true;
    if (caseFilter === 'failed') return pass === false;
    return true;
  });

  const tableColumns: DataColumn<TestResultDto>[] = [
    {
      key: 'dot', label: '', width: '20px',
      render: r => {
        const pass = resultPass(r);
        return <span style={{ width: 8, height: 8, borderRadius: '50%', background: pass === true ? 'var(--success)' : pass === false ? 'var(--danger)' : 'var(--text-muted)', display: 'inline-block' }} />;
      },
    },
    {
      key: 'case', label: 'Test case', width: '2fr',
      render: r => <span className="overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: 12.5, fontWeight: 500, paddingRight: 12 }}>{r.testCaseSummary}</span>,
    },
    {
      key: 'evaluator', label: 'Evaluator', width: '1fr',
      render: r => {
        const primary = r.evaluations[0];
        const c = primary ? (EVALUATOR_KIND_COLOR[primary.evaluatorKind as EvaluatorKind] ?? '#888') : null;
        return c ? <ColoredBadge color={c} label={primary.evaluatorName} shape="rounded" /> : <span />;
      },
    },
    {
      key: 'score', label: 'Score', width: '0.8fr',
      render: r => {
        const score = resultScore(r);
        const sc = score === null ? 'var(--text-muted)' : score >= SCORE_WARN ? 'var(--success)' : score >= SCORE_DANGER ? 'var(--warn)' : 'var(--danger)';
        return <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: sc }}>{score !== null ? score.toFixed(2) : '—'}</span>;
      },
    },
    {
      key: 'latency', label: 'Latency', width: '0.7fr',
      render: r => <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDuration(r.durationMs)}</span>,
    },
    {
      key: 'note', label: 'Note', width: '1.4fr',
      render: r => {
        const pass = resultPass(r);
        const errored = r.evaluations.find(e => isErrored(e));
        const note = errored ? (errored.errorMessage ?? '') : (r.evaluations.find(e => e.reasoning)?.reasoning ?? '');
        const color = errored ? 'var(--warn)' : (pass ? 'var(--text-muted)' : 'var(--danger)');
        return <span className="overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: 11.5, color }}>{note}</span>;
      },
    },
  ];

  const evalNames = run.evaluators.map(e => e.name).join(', ') || '—';

  return (
    <div className="flex flex-col gap-3">
      {/* KPI + minimap band */}
      <div className="bg-card rounded-xl p-[14px_16px] flex items-stretch gap-4 flex-wrap" style={{ boxShadow: 'var(--shadow-card)' }}>
        {/* Pass rate */}
        <div className="flex flex-col" style={{ minWidth: 110 }}>
          <div className="text-[10px] text-muted font-semibold uppercase tracking-[0.07em] mb-1">Pass rate</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: run.status === TestRunStatus.Completed || run.results.length > 0 ? pc : 'var(--text-muted)', lineHeight: 1 }}>
            {run.results.length > 0 ? `${passRate}%` : '—'}
          </div>
          <div className="text-[10.5px] text-muted mt-[3px] mono">{run.passedCases}/{run.totalCases}</div>
        </div>

        {/* Duration / progress */}
        <div className="flex flex-col" style={{ minWidth: 100 }}>
          <div className="text-[10px] text-muted font-semibold uppercase tracking-[0.07em] mb-1">
            {active ? 'Progress' : 'Duration'}
          </div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
            {active ? `${run.results.length}/${run.totalCases}` : fmtDuration(run.durationMs)}
          </div>
          <div className="text-[10.5px] text-muted mt-[3px]">
            {active
              ? <span className="inline-flex items-center gap-[5px]"><span className="pulse-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-primary)', display: 'inline-block' }} />executing</span>
              : 'wall time'
            }
          </div>
        </div>

        {/* Avg latency */}
        <div className="flex flex-col" style={{ minWidth: 100 }}>
          <div className="text-[10px] text-muted font-semibold uppercase tracking-[0.07em] mb-1">Avg latency</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
            {avg !== null ? fmtDuration(avg) : '—'}
          </div>
          <div className="text-[10.5px] text-muted mt-[3px]">per case</div>
        </div>

        {/* Minimap */}
        <div className="flex-1" style={{ minWidth: 220 }}>
          <div className="text-[10px] text-muted font-semibold uppercase tracking-[0.07em] mb-[6px] flex justify-between">
            <span>Cases</span>
            <span className="mono" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
              <span className="text-success">{passed} passed</span>
              {failed > 0 && <> · <span className="text-danger">{failed} failed</span></>}
            </span>
          </div>
          <Minimap
            run={run}
            activeCaseIds={activeCaseIds}
            selectedCaseId={selectedCase?.caseId ?? null}
            onPick={(r, i) => setSelectedCase(selectedCase?.caseId === r.testCaseId ? null : { runId: run.id, caseId: r.testCaseId, summary: r.testCaseSummary, idx: i })}
            size={18}
          />
        </div>
      </div>

      {/* Case results explorer */}
      {run.results.length > 0 && (
        <div className="bg-card rounded-[14px] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          {/* Toolbar */}
          <div className="flex items-center justify-between p-[10px_14px] border-b border-hairline gap-3 flex-wrap">
            <div className="flex items-center gap-[10px] min-w-0">
              <span className="text-[12.5px] font-semibold">Test case results</span>
              <span className="text-[11px] text-muted overflow-hidden text-ellipsis whitespace-nowrap">
                Evaluators: <span className="text-secondary">{evalNames}</span>
              </span>
            </div>
            <div className="flex items-center gap-[6px]">
              {/* Filter tabs */}
              <div className="flex gap-[2px] p-[2px] bg-card-2 rounded-lg">
                {([['all', 'All', run.results.length], ['passed', 'Passed', passed], ['failed', 'Failed', failed]] as [CaseFilter, string, number][]).map(([f, label, count]) => (
                  <button key={f} onClick={() => setCaseFilter(f)} className={`px-[9px] py-1 rounded-md text-[11px] font-medium cursor-pointer whitespace-nowrap ${caseFilter === f ? 'bg-card text-primary' : 'bg-transparent text-muted'}`} style={{ boxShadow: caseFilter === f ? 'var(--shadow-pill)' : 'none' }}>
                    {label} <span className="mono text-[10px] opacity-70">{count}</span>
                  </button>
                ))}
              </div>
              {/* View toggle */}
              <div className="flex gap-[2px] p-[2px] bg-card-2 rounded-lg">
                <button onClick={() => setViewMode('grid')} title="Grid view" className={`w-[26px] h-[26px] rounded-md border-none cursor-pointer flex items-center justify-center ${viewMode === 'grid' ? 'bg-card text-primary' : 'bg-transparent text-muted'}`} style={{ boxShadow: viewMode === 'grid' ? 'var(--shadow-pill)' : 'none' }}>
                  <GridIcon size={13} />
                </button>
                <button onClick={() => setViewMode('table')} title="Table view" className={`w-[26px] h-[26px] rounded-md border-none cursor-pointer flex items-center justify-center ${viewMode === 'table' ? 'bg-card text-primary' : 'bg-transparent text-muted'}`} style={{ boxShadow: viewMode === 'table' ? 'var(--shadow-pill)' : 'none' }}>
                  <TableIcon size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Grid view */}
          {viewMode === 'grid' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10, padding: 12 }}>
              {filteredResults.map((r, i) => {
                const isSelected = selectedCase?.caseId === r.testCaseId;
                return (
                  <CaseCard
                    key={r.id}
                    r={r}
                    isSelected={isSelected}
                    onClick={() => setSelectedCase(isSelected ? null : { runId: run.id, caseId: r.testCaseId, summary: r.testCaseSummary, idx: i })}
                  />
                );
              })}
              {caseFilter === 'all' && run.testCases
                .filter(tc => !run.results.some(r => r.testCaseId === tc.id))
                .map(tc => {
                  const running = activeCaseIds?.has(tc.id) ?? false;
                  return (
                    <div key={tc.id} style={{ padding: '12px 14px', border: `1px dashed ${running ? 'color-mix(in srgb, var(--accent-primary) 38%, transparent)' : 'var(--hairline)'}`, borderRadius: 'var(--radius-md)', background: running ? 'color-mix(in srgb, var(--accent-primary) 5%, transparent)' : 'transparent', opacity: running ? 0.85 : 0.45 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                        <span className={running ? 'pulse-dot' : undefined} style={{ width: 7, height: 7, borderRadius: '50%', background: running ? 'var(--accent-primary)' : 'var(--text-muted)', flexShrink: 0, display: 'inline-block' }} />
                        <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tc.id.slice(0, 7)}</span>
                      </div>
                      <div className="overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: 13, color: running ? 'var(--text-primary)' : 'var(--text-muted)', marginBottom: 4 }}>{tc.summary}</div>
                      <div style={{ fontSize: 11, color: running ? 'var(--accent-hover)' : 'var(--text-muted)' }}>{running ? 'running…' : 'pending'}</div>
                    </div>
                  );
                })
              }
            </div>
          )}

          {/* Table view */}
          {viewMode === 'table' && (
            <div className="overflow-hidden rounded-b-[14px]">
              <DataTable
                columns={tableColumns}
                rows={filteredResults}
                rowKey={r => r.id}
                onRowClick={(r, i) => setSelectedCase(selectedCase?.caseId === r.testCaseId ? null : { runId: run.id, caseId: r.testCaseId, summary: r.testCaseSummary, idx: i })}
                isSelected={r => selectedCase?.caseId === r.testCaseId}
              />
            </div>
          )}
        </div>
      )}

      {selectedCase && (
        <FixtureDrawer
          runId={selectedCase.runId}
          caseId={selectedCase.caseId}
          caseIdx={selectedCase.idx}
          total={run.results.length}
          caseSummary={selectedCase.summary}
          onClose={() => setSelectedCase(null)}
          onPrev={selectedCase.idx > 0 ? () => {
            const prev = run.results[selectedCase.idx - 1];
            if (prev) setSelectedCase({ runId: run.id, caseId: prev.testCaseId, summary: prev.testCaseSummary, idx: selectedCase.idx - 1 });
          } : undefined}
          onNext={selectedCase.idx < run.results.length - 1 ? () => {
            const next = run.results[selectedCase.idx + 1];
            if (next) setSelectedCase({ runId: run.id, caseId: next.testCaseId, summary: next.testCaseSummary, idx: selectedCase.idx + 1 });
          } : undefined}
        />
      )}
    </div>
  );
}

// ─── GroupDetail ─────────────────────────────────────────────────────────────

function GroupDetail({ group, onDelete }: { group: TestRunGroupDto; onDelete: () => void }) {
  const qc = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(group.runs[0]?.id ?? null);
  const [activeCaseIds, setActiveCaseIds] = useState<Set<string>>(new Set());
  const c = agentColor(group.agentId);
  const active = group.runs.some(r => isActive(r.status));

  const cancelGroup = useMutation({
    mutationFn: () => testRunGroupsApi.cancel(group.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['test-run-groups'] }),
  });

  const handleStreamEvent = useCallback((e: TestRunEvent) => {
    if (e.type === 'test-case-started') {
      setActiveCaseIds(prev => new Set([...prev, e.testCaseId]));
    } else if (e.type === 'test-result-arrived') {
      setActiveCaseIds(prev => { const next = new Set(prev); next.delete(e.testCaseId); return next; });
    }
    qc.invalidateQueries({ queryKey: ['test-run-groups'] });
  }, [qc]);

  const handleStreamDone = useCallback(() => {
    setActiveCaseIds(new Set());
    qc.invalidateQueries({ queryKey: ['test-run-groups'] });
  }, [qc]);

  useTestRunGroupStream(active ? group.id : null, handleStreamEvent, handleStreamDone);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => qc.invalidateQueries({ queryKey: ['test-run-groups'] }), 5000);
    return () => clearInterval(t);
  }, [active, qc]);

  const selectedRun = group.runs.find(r => r.id === selectedRunId) ?? group.runs[0] ?? null;
  const multipleRuns = group.runs.length > 1;

  return (
    <div className="flex flex-col gap-3">
      {/* Unified header */}
      <div className="bg-card rounded-[14px] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div style={{ height: 3, background: `linear-gradient(90deg, ${c}, color-mix(in srgb, ${c} 28%, transparent))` }} />
        <div className="px-[18px] py-[12px] flex items-center gap-3 flex-wrap">
          <div className="flex flex-col gap-[3px] min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[17px] font-bold tracking-[-0.01em] m-0 overflow-hidden text-ellipsis whitespace-nowrap">{group.suiteName}</h2>
              <span className="px-2 py-[2px] rounded-full text-body-sm font-semibold shrink-0" style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c, border: `1px solid color-mix(in srgb, ${c} 32%, transparent)` }}>{group.agentName}</span>
              <span className="px-[7px] py-[2px] rounded-full text-[10px] font-semibold shrink-0" style={{ background: `${statusColor(group.status)}18`, color: statusColor(group.status) }}>{group.status}</span>
              {active && (
                <span className="inline-flex items-center gap-[5px] text-[10.5px] text-muted shrink-0">
                  <span className="pulse-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-primary)', display: 'inline-block' }} />
                  live
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11.5px] text-muted">
              <span className="mono">{group.id.slice(0, 8)}</span>
              <span>·</span>
              <span>{fmtRelative(group.createdAt)}</span>
              <span>·</span>
              <span>{group.runs.length} run{group.runs.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {active && (
              <button onClick={() => cancelGroup.mutate()} data-write className="text-[12px] px-[10px] py-[5px] rounded-[7px] border border-border bg-transparent text-secondary cursor-pointer">Cancel</button>
            )}
            <button onClick={onDelete} className="btn-icon btn-icon-danger" title="Delete run group"><TrashIcon size={14} /></button>
          </div>
        </div>
      </div>

      {/* Endpoint comparison strip (only when multiple runs) */}
      {multipleRuns && (
        <div className="flex gap-[10px] flex-wrap">
          {group.runs.map(run => (
            <EndpointCompareCard
              key={run.id}
              run={run}
              isSelected={selectedRunId === run.id}
              onSelect={() => setSelectedRunId(run.id)}
              activeCaseIds={selectedRunId === run.id ? activeCaseIds : undefined}
            />
          ))}
        </div>
      )}

      {/* Selected run detail */}
      {selectedRun && <RunDetail key={selectedRun.id} run={selectedRun} activeCaseIds={activeCaseIds} />}
    </div>
  );
}

// ─── Runs (page) ─────────────────────────────────────────────────────────────

export default function Runs() {
  const qc = useQueryClient();
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;
  const enabled = currentProjectId !== null;
  const [agentFilter, setAgentFilter] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.testRunGroups(agentFilter, projectId),
    queryFn: () => testRunGroupsApi.list({ agentId: agentFilter || undefined, projectId: agentFilter ? undefined : projectId, pageSize: 100 }),
    refetchInterval: REFETCH_INTERVAL_LIVE,
    enabled,
  });
  const { data: agentsData } = useQuery({
    queryKey: QUERY_KEYS.agents(projectId),
    queryFn: () => agentsApi.list({ projectId, pageSize: LIST_PAGE_SIZE }),
    enabled,
  });

  const groups = data?.items ?? [];
  const agents = agentsData?.items ?? [];

  const selectedGroup = groups.find(g => g.id === selectedGroupId) ?? groups[0] ?? null;
  const agentOptions = [
    { key: '', label: 'All agents' },
    ...agents.map(a => ({ key: a.id, label: a.name, accent: agentColor(a.id) })),
  ];

  const delGroup = useMutation({
    mutationFn: () => testRunGroupsApi.delete(deleteGroupId!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['test-run-groups'] }); setDeleteGroupId(null); if (deleteGroupId === selectedGroupId) setSelectedGroupId(null); },
  });

  const deleteTarget = groups.find(g => g.id === deleteGroupId);

  return (
    <div className="w-full min-w-0 flex flex-col gap-[14px]">
      <div className="fade-up grid gap-[14px] items-start" style={{ animationDelay: '40ms', gridTemplateColumns: '280px 1fr' }}>
        {/* Left: group list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          {/* Agent filter — dropdown */}
          <div className="flex">
            <FilterDropdown
              label="Agent"
              value={agentFilter}
              options={agentOptions}
              onChange={setAgentFilter}
              active={agentFilter !== ''}
              accent={agentFilter ? agentColor(agentFilter) : undefined}
              width={240}
            />
          </div>

          {isLoading && <SkeletonList rows={5} height={110} gap={10} />}

          {/* Group cards */}
          {groups.map(group => {
            const isSelected = selectedGroup?.id === group.id;
            const c = agentColor(group.agentId);
            const totalCases = group.runs.reduce((s, r) => s + r.totalCases, 0);
            const passedCases = group.runs.reduce((s, r) => s + r.passedCases, 0);
            const passRate = totalCases > 0 ? Math.round((passedCases / totalCases) * 100) : null;
            const pc = passRate !== null ? passColorOf(passRate) : 'var(--text-muted)';
            const runCount = group.runs.length;
            return (
              <button
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                className="overflow-hidden border-none cursor-pointer"
                style={{
                  textAlign: 'left', width: '100%', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
                  padding: '12px 14px 12px 17px',
                  boxShadow: isSelected ? `0 1px 0 rgba(255,255,255,0.07) inset, 0 0 0 1.5px color-mix(in srgb, ${c} 38%, transparent), 0 8px 24px -8px color-mix(in srgb, ${c} 28%, transparent)` : 'var(--shadow-card)',
                  transition: 'box-shadow 0.15s', position: 'relative',
                }}
              >
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: c, borderRadius: 'var(--radius-lg) 0 0 var(--radius-lg)' }} />
                <div className="flex items-center justify-between mb-[6px]">
                  {runCount > 1
                    ? <span className="px-[6px] py-[1px] rounded text-[9.5px] font-semibold mono" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>{runCount} models</span>
                    : <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{fmtRelative(group.createdAt)}</span>
                  }
                  <div className="flex items-center gap-[6px]">
                    {runCount > 1 && <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{fmtRelative(group.createdAt)}</span>}
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteGroupId(group.id); }}
                      className="btn-icon btn-icon-danger"
                    ><TrashIcon size={13} /></button>
                  </div>
                </div>
                <div className="overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{group.suiteName}</div>
                <div style={{ marginBottom: 8 }}>
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 100, background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c, fontSize: 10, fontWeight: 600, maxWidth: '100%', border: `1px solid color-mix(in srgb, ${c} 32%, transparent)` }}>{group.agentName}</span>
                </div>
                {group.status === TestRunStatus.Completed && passRate !== null ? (
                  <div className="flex items-center justify-between">
                    <span className="mono" style={{ fontSize: 17, fontWeight: 700, color: pc }}>{passRate}%</span>
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{passedCases}/{totalCases}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-[6px]">
                    <span className={isActive(group.status) ? 'pulse-dot' : undefined} style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor(group.status), flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontSize: 11.5, color: statusColor(group.status), fontWeight: 600 }}>{group.status}</span>
                  </div>
                )}
              </button>
            );
          })}

          {!isLoading && groups.length === 0 && (
            <EmptyState title="No test runs yet" description="Run a suite to get started." />
          )}
        </div>

        {/* Right: detail */}
        <div style={{ minWidth: 0 }}>
          {selectedGroup
            ? <GroupDetail key={selectedGroup.id} group={selectedGroup} onDelete={() => setDeleteGroupId(selectedGroup.id)} />
            : <div className="p-[60px] text-center text-muted text-[13px] bg-card rounded-[14px]" style={{ boxShadow: 'var(--shadow-card)' }}>Select a run to see details.</div>
          }
        </div>
      </div>

      {deleteGroupId && deleteTarget && (
        <ConfirmDialog entityName={deleteTarget.suiteName} onConfirm={() => delGroup.mutate()} onCancel={() => setDeleteGroupId(null)} loading={delGroup.isPending} />
      )}
    </div>
  );
}
