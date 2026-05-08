import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { testRunGroupsApi } from '../../api/test-run-groups';
import { agentsApi } from '../../api/agents';
import { QUERY_KEYS } from '../../api/query-keys';
import { useCurrentProject } from '../../contexts/ProjectContext';
import { TestRunStatus, EvaluatorKind, EvaluationScore, type TestRunDto, type TestRunGroupDto, type TestResultDto, type TestRunEvent } from '../../api/models';

const PASSING_SCORES = new Set<EvaluationScore>([EvaluationScore.Acceptable, EvaluationScore.Good, EvaluationScore.Excellent]);
const isPass = (score: EvaluationScore) => PASSING_SCORES.has(score);
import { GridIcon, TableIcon, TrashIcon } from '../../components/icons';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { useTestRunGroupStream } from '../../api/event-stream';
import { agentColor, modelColor, EVALUATOR_KIND_COLOR } from '../../lib/colors';
import { fmtDuration, fmtRelative } from '../../lib/format';
import { ColoredBadge } from '../../components/ui/ColoredBadge';
import { DataTable } from '../../components/ui/DataTable';
import type { DataColumn } from '../../components/ui/DataTable';
import { FixtureDrawer } from './FixtureDrawer';
import { useToast } from '../../components/ui/Toast';
import { EmptyState } from '../../components/ui/EmptyState';
import { PASS_RATE_WARN, PASS_RATE_DANGER, SCORE_WARN, SCORE_DANGER, REFETCH_INTERVAL_LIVE, LIST_PAGE_SIZE } from '../../lib/constants';

type CaseFilter = 'all' | 'passed' | 'failed';
type ViewMode = 'table' | 'grid';

// ─── CaseCard (grid view) ─────────────────────────────────────────────────────

function CaseCard({ r, isSelected, onClick }: { r: TestResultDto; isSelected: boolean; onClick: () => void }) {
  const pass = r.evaluations.length === 0 ? null : r.evaluations.every(e => isPass(e.score));
  const passCount = r.evaluations.filter(e => isPass(e.score)).length;
  const score = r.evaluations.length > 0 ? passCount / r.evaluations.length : null;
  const scoreColor = score === null ? 'var(--text-muted)' : score >= SCORE_WARN ? 'var(--success)' : score >= SCORE_DANGER ? 'var(--warn)' : 'var(--danger)';
  const dotColor = pass === true ? 'var(--success)' : pass === false ? 'var(--danger)' : 'var(--text-muted)';
  const primaryEval = r.evaluations[0];
  const evalColor = primaryEval ? (EVALUATOR_KIND_COLOR[primaryEval.evaluatorKind as EvaluatorKind] ?? '#888') : null;

  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left', padding: '14px 16px 0', cursor: 'pointer', width: '100%',
        background: isSelected ? 'rgba(201,148,74,0.06)' : 'var(--bg-card-2)',
        border: `1px solid ${isSelected ? 'rgba(201,148,74,0.35)' : 'var(--hairline)'}`,
        borderRadius: 12,
        display: 'flex', flexDirection: 'column',
        transition: 'background 0.1s, border-color 0.1s',
        overflow: 'hidden',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-card-2)'; }}
    >
      {/* Row 1: dot + id | score */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0, boxShadow: pass !== null ? `0 0 6px ${dotColor}cc` : 'none' }} />
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.testCaseId.slice(0, 7)}</span>
        </div>
        <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: scoreColor, letterSpacing: '-0.03em' }}>
          {score !== null ? score.toFixed(2) : '—'}
        </span>
      </div>
      {/* Row 2: case name */}
      <div className="overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>
        {r.testCaseSummary}
      </div>
      {/* Row 3: evaluator pill + latency */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        {evalColor
          ? <ColoredBadge color={evalColor} label={primaryEval.evaluatorName} shape="rounded" />
          : <span />
        }
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDuration(r.durationMs)}</span>
      </div>
      {/* Row 4: progress bar flush to card bottom */}
      <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', marginLeft: -16, marginRight: -16 }}>
        {score !== null && (
          <div style={{ height: '100%', width: `${Math.round(score * 100)}%`, background: scoreColor }} />
        )}
      </div>
    </button>
  );
}

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

// ─── RunDetail ────────────────────────────────────────────────────────────────

function RunDetail({ run, group, activeCaseIds }: { run: TestRunDto; group: TestRunGroupDto; activeCaseIds?: Set<string> }) {
  const [selectedCase, setSelectedCase] = useState<{ runId: string; caseId: string; summary: string; idx: number } | null>(null);
  const [caseFilter, setCaseFilter] = useState<CaseFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const passed = run.results.filter(r => r.evaluations.length > 0 && r.evaluations.every(e => isPass(e.score))).length;
  const failed = run.results.filter(r => r.evaluations.some(e => !isPass(e.score))).length;
  const passRate = run.totalCases > 0 ? Math.round((run.passedCases / run.totalCases) * 100) : 0;
  const passColor = passRate >= PASS_RATE_WARN ? 'var(--success)' : passRate >= PASS_RATE_DANGER ? 'var(--warn)' : 'var(--danger)';

  const filteredResults = run.results.filter(r => {
    if (caseFilter === 'all') return true;
    const pass = r.evaluations.length === 0 ? null : r.evaluations.every(e => isPass(e.score));
    if (caseFilter === 'passed') return pass === true;
    if (caseFilter === 'failed') return pass === false;
    return true;
  });

  const RESULT_GRID_COLS = '20px 2fr 1fr 0.8fr 0.7fr 1.4fr';
  const tableColumns: DataColumn<TestResultDto>[] = [
    {
      key: 'dot', label: '', width: '20px',
      render: r => {
        const pass = r.evaluations.length === 0 ? null : r.evaluations.every(e => isPass(e.score));
        return <span style={{ width: 8, height: 8, borderRadius: '50%', background: pass === true ? 'var(--success)' : pass === false ? 'var(--danger)' : 'var(--text-muted)', display: 'inline-block', boxShadow: pass !== null ? `0 0 5px ${pass ? 'rgba(61,170,111,0.5)' : 'rgba(217,85,85,0.5)'}` : 'none' }} />;
      },
    },
    {
      key: 'case', label: 'Test case', width: '2fr',
      render: r => <span className="overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: 12.5, fontWeight: 500, paddingRight: 12 }}>{r.testCaseSummary}</span>,
    },
    {
      key: 'evaluator', label: 'Evaluator', width: '1fr',
      render: r => {
        const primaryEval = r.evaluations[0];
        const evalColor = primaryEval ? (EVALUATOR_KIND_COLOR[primaryEval.evaluatorKind as EvaluatorKind] ?? '#888') : null;
        return evalColor ? <ColoredBadge color={evalColor} label={primaryEval.evaluatorName} shape="rounded" /> : <span />;
      },
    },
    {
      key: 'score', label: 'Score', width: '0.8fr',
      render: r => {
        const tPassCount = r.evaluations.filter(e => isPass(e.score)).length;
        const score = r.evaluations.length > 0 ? tPassCount / r.evaluations.length : null;
        const scoreColor = score === null ? 'var(--text-muted)' : score >= SCORE_WARN ? 'var(--success)' : score >= SCORE_DANGER ? 'var(--warn)' : 'var(--danger)';
        return <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: scoreColor }}>{score !== null ? score.toFixed(2) : '—'}</span>;
      },
    },
    {
      key: 'latency', label: 'Latency', width: '0.7fr',
      render: r => <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDuration(r.durationMs)}</span>,
    },
    {
      key: 'note', label: 'Note', width: '1.4fr',
      render: r => {
        const pass = r.evaluations.length === 0 ? null : r.evaluations.every(e => isPass(e.score));
        const note = r.evaluations.find(e => e.reasoning)?.reasoning ?? r.evaluations.find(e => !isPass(e.score))?.score ?? '';
        return <span className="overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: 11.5, color: pass ? 'var(--text-muted)' : '#fca5a5' }}>{note}</span>;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Run header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-[6px]">
            <span className="mono text-[12px] text-muted">{run.id.slice(0, 12)}…</span>
            {run.status === TestRunStatus.Completed && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 100, background: passRate >= PASS_RATE_WARN ? 'var(--success-subtle)' : passRate >= PASS_RATE_DANGER ? 'var(--warn-subtle)' : 'var(--danger-subtle)', color: passColor, fontSize: 10.5, fontWeight: 600 }}>
                {run.passedCases}/{run.totalCases} passed
              </span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 100, background: `${statusColor(run.status)}18`, color: statusColor(run.status), fontSize: 10.5, fontWeight: 600 }}>
              {run.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-[17px] font-bold tracking-[-0.01em] m-0">{group.suiteName}</h2>
            <span className="text-muted">·</span>
            <span className="px-2 py-[2px] rounded-full text-[11px] font-semibold" style={{ background: agentColor(group.agentId) + '20', color: agentColor(group.agentId) }}>{group.agentName}</span>
          </div>
          <div className="text-[12px] text-muted mt-1">{fmtRelative(group.createdAt)} · {run.endpointName}</div>
        </div>
      </div>

      {/* Stats band */}
      <div className="grid gap-[10px]" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {[
          { label: 'Pass rate',  value: run.status === TestRunStatus.Completed ? `${passRate}%` : '—', color: run.status === TestRunStatus.Completed ? passColor : 'var(--text-muted)', sub: `${run.passedCases} of ${run.totalCases}` },
          { label: 'Passed',     value: String(run.passedCases), color: 'var(--success)', sub: 'test cases' },
          { label: 'Failed',     value: String(run.failedCases), color: 'var(--danger)', sub: 'need attention' },
          { label: 'Duration',   value: fmtDuration(run.durationMs), color: 'var(--text-primary)', sub: 'wall time' },
          { label: 'Evaluators', value: String(run.evaluators.length), color: 'var(--text-primary)', sub: run.evaluators.map(e => e.name).join(', ') || '—' },
        ].map(s => (
          <div key={s.label} className="px-[14px] py-3 bg-card rounded-xl" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="text-[10px] text-muted font-semibold uppercase tracking-[0.07em] mb-1">{s.label}</div>
            <div className="text-[20px] font-bold tracking-[-0.02em]" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10.5px] text-muted mt-[2px] overflow-hidden text-ellipsis whitespace-nowrap">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Execution progress (shown while running) */}
      {isActive(run.status) && (
        <div className="px-4 py-3 bg-card rounded-xl" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-[7px]">
              <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)', display: 'inline-block' }} />
              <span className="text-[12px] font-semibold">Executing</span>
            </div>
            <span className="mono text-[11px] text-muted">{run.results.length} / {run.totalCases} complete</span>
          </div>
          <ProgressBar value={run.results.length} max={run.totalCases} color="var(--accent-primary)" height={6} />
        </div>
      )}

      {/* Minimap */}
      {run.results.length > 0 && (
        <div className="px-4 py-3 bg-card rounded-xl" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-[12px] font-semibold">Results at a glance</span>
            <span className="mono text-[11px] text-muted">{passed} passed · {failed} failed</span>
          </div>
          <ProgressBar value={run.passedCases} max={run.totalCases} height={7} />
          <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
            {run.results.map((r, i) => {
              const pass = r.evaluations.length === 0 ? null : r.evaluations.every(e => isPass(e.score));
              const isSelected = selectedCase?.caseId === r.testCaseId;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedCase(isSelected ? null : { runId: run.id, caseId: r.testCaseId, summary: r.testCaseSummary, idx: i })}
                  title={r.testCaseSummary}
                  style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, background: pass === true ? 'rgba(16,185,129,0.22)' : pass === false ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)', border: `1.5px solid ${isSelected ? '#fff' : pass === true ? 'rgba(16,185,129,0.5)' : pass === false ? 'rgba(239,68,68,0.4)' : 'var(--border-color)'}`, transition: 'transform 0.1s', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.25)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Case results explorer */}
      {run.results.length > 0 && (
        <div className="bg-card rounded-[14px] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          {/* Toolbar */}
          <div className="flex items-center justify-between p-[10px_14px] border-b border-hairline">
            <div className="flex items-center gap-[10px]">
              <span className="text-[12.5px] font-semibold">Test case results</span>
              <span className="text-[11px] text-muted">
                <span className="text-success font-semibold">{passed} passed</span>
                {' · '}
                <span className={`font-semibold ${failed > 0 ? 'text-danger' : 'text-muted'}`}>{failed} failed</span>
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

          {/* Grid view — rounded cards with gap */}
          {viewMode === 'grid' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, padding: 12 }}>
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
              {run.testCases
                .filter(tc => !run.results.some(r => r.testCaseId === tc.id))
                .map(tc => {
                  const running = activeCaseIds?.has(tc.id) ?? false;
                  return (
                    <div key={tc.id} style={{ padding: '14px 16px 14px', border: `1px solid ${running ? 'rgba(201,148,74,0.35)' : 'var(--hairline)'}`, borderRadius: 12, background: running ? 'rgba(201,148,74,0.04)' : 'var(--bg-card-2)', opacity: running ? 0.85 : 0.4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                        <span className={running ? 'pulse-dot' : undefined} style={{ width: 7, height: 7, borderRadius: '50%', background: running ? 'var(--accent-primary)' : 'var(--text-muted)', flexShrink: 0, boxShadow: running ? '0 0 6px rgba(201,148,74,0.5)' : 'none', display: 'inline-block' }} />
                        <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tc.id.slice(0, 7)}</span>
                      </div>
                      <div className="overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: 13, color: running ? 'var(--text-primary)' : 'var(--text-muted)', marginBottom: 6 }}>{tc.summary}</div>
                      <div style={{ fontSize: 11, color: running ? 'var(--accent-hover)' : 'var(--text-muted)' }}>{running ? 'running…' : 'pending…'}</div>
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
              {/* Pending cases */}
              {run.testCases
                .filter(tc => !run.results.some(r => r.testCaseId === tc.id))
                .map(tc => {
                  const running = activeCaseIds?.has(tc.id) ?? false;
                  return (
                    <div key={tc.id} className="grid px-4 py-[11px] items-center border-b border-hairline" style={{ gridTemplateColumns: RESULT_GRID_COLS, opacity: running ? 1 : 0.5 }}>
                      <span className={running ? 'pulse-dot' : undefined} style={{ width: 8, height: 8, borderRadius: '50%', background: running ? 'var(--accent-primary)' : 'var(--text-muted)', display: 'inline-block', boxShadow: running ? '0 0 6px rgba(201,148,74,0.5)' : 'none' }} />
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: running ? 'var(--text-primary)' : 'var(--text-muted)' }}>{tc.summary}</span>
                      <span />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                      <span style={{ fontSize: 11, color: running ? 'var(--accent-hover)' : 'var(--text-muted)' }}>{running ? 'running…' : 'pending…'}</span>
                      <span />
                    </div>
                  );
                })
              }
            </div>
          )}
        </div>
      )}

      {/* Selected case drawer */}
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

// ─── GroupDetail ──────────────────────────────────────────────────────────────

function GroupDetail({ group }: { group: TestRunGroupDto }) {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(group.runs[0]?.id ?? null);
  const [activeCaseIds, setActiveCaseIds] = useState<Set<string>>(new Set());
  const c = agentColor(group.agentId);
  const active = group.runs.some(r => isActive(r.status));

  const cancelGroup = useMutation({
    mutationFn: () => testRunGroupsApi.cancel(group.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['test-run-groups'] }),
    onError: (err) => toast((err as Error).message || 'Failed to cancel run', 'error'),
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

  useTestRunGroupStream(
    active ? group.id : null,
    handleStreamEvent,
    handleStreamDone,
  );

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => qc.invalidateQueries({ queryKey: ['test-run-groups'] }), 5000);
    return () => clearInterval(t);
  }, [active, qc]);

  const selectedRun = group.runs.find(r => r.id === selectedRunId) ?? group.runs[0] ?? null;

  return (
    <div className="flex flex-col gap-3">
      {/* Group header */}
      <div className="bg-card rounded-[14px] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div style={{ height: 3, background: `linear-gradient(90deg, ${c}, ${c}44)` }} />
        <div className="px-[18px] py-[14px] flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[15px] font-bold">{group.suiteName}</span>
              <span className="px-2 py-[2px] rounded-full text-[10.5px] font-semibold" style={{ background: c + '20', color: c }}>{group.agentName}</span>
              <span className="px-[7px] py-[2px] rounded-full text-[10px] font-semibold" style={{ background: `${statusColor(group.status)}18`, color: statusColor(group.status) }}>{group.status}</span>
            </div>
            <span className="text-[11.5px] text-muted">{fmtRelative(group.createdAt)} · {group.runs.length} run{group.runs.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="ml-auto flex gap-2">
            {active && (
              <button onClick={() => cancelGroup.mutate()} className="text-[12px] px-[10px] py-[5px] rounded-[7px] border border-border bg-transparent text-secondary cursor-pointer">Cancel</button>
            )}
          </div>
        </div>
      </div>

      {/* Run tabs (if multiple) */}
      {group.runs.length > 1 && (
        <div className="flex gap-1 p-1 bg-card rounded-[10px] flex-wrap" style={{ boxShadow: 'var(--shadow-pill)' }}>
          {group.runs.map(run => {
            const isActive = selectedRunId === run.id;
            const mc = modelColor(run.endpointName);
            const rPassRate = run.totalCases > 0 ? Math.round((run.passedCases / run.totalCases) * 100) : null;
            return (
              <button key={run.id} onClick={() => setSelectedRunId(run.id)} style={{ flex: '1 1 auto', padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, background: isActive ? 'var(--bg-card-2)' : 'transparent', color: isActive ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: isActive ? 'var(--shadow-pill)' : 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: 2, background: mc }} />
                {run.endpointName}
                {rPassRate !== null && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: rPassRate >= PASS_RATE_WARN ? 'var(--success)' : rPassRate >= PASS_RATE_DANGER ? 'var(--warn)' : 'var(--danger)', fontWeight: 700 }}>{rPassRate}%</span>}
              </button>
            );
          })}
        </div>
      )}

      {selectedRun && <RunDetail run={selectedRun} group={group} activeCaseIds={activeCaseIds} />}
    </div>
  );
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

export default function Runs() {
  const qc = useQueryClient();
  const { show: toast } = useToast();
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
  const agentList = ['All', ...agents.map(a => a.name)];
  const agentIds = ['', ...agents.map(a => a.id)];

  const delGroup = useMutation({
    mutationFn: () => testRunGroupsApi.delete(deleteGroupId!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['test-run-groups'] }); setDeleteGroupId(null); if (deleteGroupId === selectedGroupId) setSelectedGroupId(null); },
    onError: (err) => toast((err as Error).message || 'Failed to delete run group', 'error'),
  });

  const deleteTarget = groups.find(g => g.id === deleteGroupId);

  return (
    <div className="w-full max-w-[1480px] mx-auto min-w-0 flex flex-col gap-[14px] overflow-y-auto p-[4px_4px_24px]">
      {/* Master–detail */}
      <div className="fade-up grid gap-[14px] items-start" style={{ animationDelay: '40ms', gridTemplateColumns: '280px 1fr' }}>
        {/* Left: group list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Agent filter */}
          <div className="flex gap-[3px] p-[3px] bg-card rounded-[10px] flex-wrap" style={{ boxShadow: 'var(--shadow-pill)' }}>
            {agentList.map((a, i) => (
              <button key={a} onClick={() => setAgentFilter(agentIds[i])} className={`flex-[1_1_auto] px-2 py-[5px] rounded-[7px] text-[10.5px] font-medium whitespace-nowrap ${agentFilter === agentIds[i] ? 'bg-card-2 text-primary' : 'bg-transparent text-muted'}`} style={{ boxShadow: agentFilter === agentIds[i] ? 'var(--shadow-pill)' : 'none' }}>
                {a}
              </button>
            ))}
          </div>

          {isLoading && <div className="text-center p-5 text-muted text-[13px]">Loading…</div>}

          {/* Group cards */}
          {groups.map(group => {
            const isSelected = selectedGroup?.id === group.id;
            const c = agentColor(group.agentId);
            const totalCases = group.runs.reduce((s, r) => s + r.totalCases, 0);
            const passedCases = group.runs.reduce((s, r) => s + r.passedCases, 0);
            const passRate = totalCases > 0 ? Math.round((passedCases / totalCases) * 100) : null;
            const passColor = passRate !== null ? (passRate >= PASS_RATE_WARN ? 'var(--success)' : passRate >= PASS_RATE_DANGER ? 'var(--warn)' : 'var(--danger)') : 'var(--text-muted)';
            return (
              <button
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                className="overflow-hidden border-none cursor-pointer"
                style={{ textAlign: 'left', width: '100%', background: 'var(--bg-card)', borderRadius: 13, padding: '12px 14px 12px 17px', boxShadow: isSelected ? `0 1px 0 rgba(255,255,255,0.07) inset, 0 0 0 1.5px ${c}55, 0 8px 24px -8px ${c}44` : 'var(--shadow-card)', transition: 'box-shadow 0.15s', position: 'relative' }}
              >
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: c, borderRadius: '13px 0 0 13px' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 10.5, color: isSelected ? 'var(--accent-hover)' : 'var(--text-muted)', fontWeight: 600 }}>{group.id.slice(0, 8)}…</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{fmtRelative(group.createdAt)}</span>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteGroupId(group.id); }}
                      className="btn-icon btn-icon-danger"
                    ><TrashIcon size={13} /></button>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{group.suiteName}</div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 100, background: c + '20', color: c, fontSize: 10, fontWeight: 600 }}>{group.agentName}</span>
                </div>
                {group.status === TestRunStatus.Completed && passRate !== null ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 700, color: passColor }}>{passRate}%</span>
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{passedCases}/{totalCases}</span>
                    </div>
                    <ProgressBar value={passedCases} max={totalCases} height={5} />
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor(group.status), flexShrink: 0 }} />
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
        <div>
          {selectedGroup
            ? <GroupDetail key={selectedGroup.id} group={selectedGroup} />
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
