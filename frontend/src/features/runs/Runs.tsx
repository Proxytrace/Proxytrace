import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { testRunGroupsApi } from '../../api/test-run-groups';
import { agentsApi } from '../../api/agents';
import { TestRunStatus, EvaluatorKind, type TestRunDto, type TestRunGroupDto, type TestResultDto } from '../../api/models';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { useTestRunGroupStream } from '../../api/event-stream';
import { agentColor, modelColor, EVALUATOR_KIND_COLOR } from '../../lib/colors';
import { fmtDuration, fmtRelative } from '../../lib/format';
import { FixtureDrawer } from './FixtureDrawer';

type CaseFilter = 'all' | 'passed' | 'failed';
type ViewMode = 'table' | 'grid';

// ─── CaseCard (grid view) ─────────────────────────────────────────────────────

function CaseCard({ r, isSelected, onClick }: { r: TestResultDto; isSelected: boolean; onClick: () => void }) {
  const pass = r.evaluations.length === 0 ? null : r.evaluations.every(e => e.score === 'Pass');
  const passCount = r.evaluations.filter(e => e.score === 'Pass').length;
  const score = r.evaluations.length > 0 ? passCount / r.evaluations.length : null;
  const scoreColor = score === null ? 'var(--text-muted)' : score >= 0.8 ? 'var(--success)' : score >= 0.5 ? 'var(--warn)' : 'var(--danger)';
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
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {r.testCaseSummary}
      </div>
      {/* Row 3: evaluator pill + latency */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        {evalColor
          ? <span style={{ padding: '2px 7px', borderRadius: 5, background: evalColor + '1a', color: evalColor, fontSize: 10.5, fontWeight: 600, border: `1px solid ${evalColor}30` }}>{primaryEval.evaluatorName}</span>
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

function RunDetail({ run, group }: { run: TestRunDto; group: TestRunGroupDto }) {
  const [selectedCase, setSelectedCase] = useState<{ runId: string; caseId: string; summary: string; idx: number } | null>(null);
  const [caseFilter, setCaseFilter] = useState<CaseFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const passed = run.results.filter(r => r.evaluations.every(e => e.score === 'Pass')).length;
  const failed = run.results.filter(r => r.evaluations.some(e => e.score === 'Fail')).length;
  const passRate = run.totalCases > 0 ? Math.round((run.passedCases / run.totalCases) * 100) : 0;
  const passColor = passRate >= 75 ? 'var(--success)' : passRate >= 55 ? 'var(--warn)' : 'var(--danger)';

  const filteredResults = run.results.filter(r => {
    if (caseFilter === 'all') return true;
    const pass = r.evaluations.length === 0 ? null : r.evaluations.every(e => e.score === 'Pass');
    if (caseFilter === 'passed') return pass === true;
    if (caseFilter === 'failed') return pass === false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Run header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{run.id.slice(0, 12)}…</span>
            {run.status === TestRunStatus.Completed && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 100, background: passRate >= 75 ? 'var(--success-subtle)' : passRate >= 55 ? 'var(--warn-subtle)' : 'var(--danger-subtle)', color: passColor, fontSize: 10.5, fontWeight: 600 }}>
                {run.passedCases}/{run.totalCases} passed
              </span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 100, background: `${statusColor(run.status)}18`, color: statusColor(run.status), fontSize: 10.5, fontWeight: 600 }}>
              {run.status}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>{group.suiteName}</h2>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span style={{ padding: '2px 8px', borderRadius: 100, background: agentColor(group.agentId) + '20', color: agentColor(group.agentId), fontSize: 11, fontWeight: 600 }}>{group.agentName}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{fmtRelative(group.createdAt)} · {run.endpointName}</div>
        </div>
      </div>

      {/* Stats band */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {[
          { label: 'Pass rate',  value: run.status === TestRunStatus.Completed ? `${passRate}%` : '—', color: run.status === TestRunStatus.Completed ? passColor : 'var(--text-muted)', sub: `${run.passedCases} of ${run.totalCases}` },
          { label: 'Passed',     value: String(run.passedCases), color: 'var(--success)', sub: 'test cases' },
          { label: 'Failed',     value: String(run.failedCases), color: 'var(--danger)', sub: 'need attention' },
          { label: 'Duration',   value: fmtDuration(run.durationMs), color: 'var(--text-primary)', sub: 'wall time' },
          { label: 'Evaluators', value: String(run.evaluators.length), color: 'var(--text-primary)', sub: run.evaluators.map(e => e.name).join(', ') || '—' },
        ].map(s => (
          <div key={s.label} style={{ padding: '12px 14px', background: 'var(--bg-card)', borderRadius: 12, boxShadow: 'var(--shadow-card)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Minimap */}
      {run.results.length > 0 && (
        <div style={{ padding: '12px 16px', background: 'var(--bg-card)', borderRadius: 12, boxShadow: 'var(--shadow-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Results at a glance</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>{passed} passed · {failed} failed</span>
          </div>
          <ProgressBar value={run.passedCases} max={run.totalCases} height={7} />
          <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
            {run.results.map((r, i) => {
              const pass = r.evaluations.length === 0 ? null : r.evaluations.every(e => e.score === 'Pass');
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
        <div style={{ background: 'var(--bg-card)', borderRadius: 14, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--hairline)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Test case results</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>{passed} passed</span>
                {' · '}
                <span style={{ color: failed > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 600 }}>{failed} failed</span>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Filter tabs */}
              <div style={{ display: 'flex', gap: 2, padding: 2, background: 'var(--bg-card-2)', borderRadius: 8 }}>
                {([['all', 'All', run.results.length], ['passed', 'Passed', passed], ['failed', 'Failed', failed]] as [CaseFilter, string, number][]).map(([f, label, count]) => (
                  <button key={f} onClick={() => setCaseFilter(f)} style={{ padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', background: caseFilter === f ? 'var(--bg-card)' : 'transparent', color: caseFilter === f ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: caseFilter === f ? 'var(--shadow-pill)' : 'none', whiteSpace: 'nowrap' }}>
                    {label} <span className="mono" style={{ fontSize: 10, opacity: 0.7 }}>{count}</span>
                  </button>
                ))}
              </div>
              {/* View toggle */}
              <div style={{ display: 'flex', gap: 2, padding: 2, background: 'var(--bg-card-2)', borderRadius: 8 }}>
                <button onClick={() => setViewMode('grid')} title="Grid view" style={{ width: 26, height: 26, borderRadius: 5, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: viewMode === 'grid' ? 'var(--bg-card)' : 'transparent', boxShadow: viewMode === 'grid' ? 'var(--shadow-pill)' : 'none', color: viewMode === 'grid' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                </button>
                <button onClick={() => setViewMode('table')} title="Table view" style={{ width: 26, height: 26, borderRadius: 5, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: viewMode === 'table' ? 'var(--bg-card)' : 'transparent', boxShadow: viewMode === 'table' ? 'var(--shadow-pill)' : 'none', color: viewMode === 'table' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/></svg>
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
                .map(tc => (
                  <div key={tc.id} style={{ padding: '14px 16px 14px', border: '1px solid var(--hairline)', borderRadius: 12, background: 'var(--bg-card-2)', opacity: 0.4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text-muted)', flexShrink: 0 }} />
                      <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tc.id.slice(0, 7)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>{tc.summary}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>pending…</div>
                  </div>
                ))
              }
            </div>
          )}

          {/* Table view */}
          {viewMode === 'table' && (
            <div style={{ overflow: 'hidden', borderRadius: '0 0 14px 14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '20px 2fr 1fr 0.8fr 0.7fr 1.4fr', padding: '10px 16px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', borderBottom: '1px solid var(--hairline)' }}>
                <span /><span>Test case</span><span>Evaluator</span><span>Score</span><span>Latency</span><span>Note</span>
              </div>
              {filteredResults.map((r, i) => {
                const pass = r.evaluations.length === 0 ? null : r.evaluations.every(e => e.score === 'Pass');
                const tPassCount = r.evaluations.filter(e => e.score === 'Pass').length;
                const score = r.evaluations.length > 0 ? tPassCount / r.evaluations.length : null;
                const isSelected = selectedCase?.caseId === r.testCaseId;
                const scoreColor = score === null ? 'var(--text-muted)' : score >= 0.8 ? 'var(--success)' : score >= 0.5 ? 'var(--warn)' : 'var(--danger)';
                const note = r.evaluations.find(e => e.reasoning)?.reasoning ?? r.evaluations.find(e => e.score === 'Fail')?.score ?? '';
                const primaryEval = r.evaluations[0];
                const evalColor = primaryEval ? (EVALUATOR_KIND_COLOR[primaryEval.evaluatorKind as EvaluatorKind] ?? '#888') : null;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedCase(isSelected ? null : { runId: run.id, caseId: r.testCaseId, summary: r.testCaseSummary, idx: i })}
                    style={{ display: 'grid', width: '100%', textAlign: 'left', gridTemplateColumns: '20px 2fr 1fr 0.8fr 0.7fr 1.4fr', padding: '11px 16px', alignItems: 'center', borderTop: '1px solid var(--hairline)', background: isSelected ? 'rgba(201,148,74,0.06)' : 'transparent', transition: 'background 0.1s', cursor: 'pointer', border: 'none' }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: pass === true ? 'var(--success)' : pass === false ? 'var(--danger)' : 'var(--text-muted)', display: 'inline-block', boxShadow: pass !== null ? `0 0 5px ${pass ? 'rgba(61,170,111,0.5)' : 'rgba(217,85,85,0.5)'}` : 'none' }} />
                    <span style={{ fontSize: 12.5, fontWeight: 500, paddingRight: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.testCaseSummary}</span>
                    {evalColor ? (
                      <span style={{ padding: '2px 7px', borderRadius: 5, background: evalColor + '1a', color: evalColor, fontSize: 10.5, fontWeight: 600, display: 'inline-block', border: `1px solid ${evalColor}30`, justifySelf: 'start', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{primaryEval.evaluatorName}</span>
                    ) : <span />}
                    <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: scoreColor }}>{score !== null ? score.toFixed(2) : '—'}</span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDuration(r.durationMs)}</span>
                    <span style={{ fontSize: 11.5, color: pass ? 'var(--text-muted)' : '#fca5a5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note}</span>
                  </button>
                );
              })}
              {/* Pending cases */}
              {run.testCases
                .filter(tc => !run.results.some(r => r.testCaseId === tc.id))
                .map(tc => (
                  <div key={tc.id} style={{ display: 'grid', gridTemplateColumns: '20px 2fr 1fr 0.8fr 0.7fr 1.4fr', padding: '11px 16px', alignItems: 'center', borderTop: '1px solid var(--hairline)', opacity: 0.5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block' }} />
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-muted)' }}>{tc.summary}</span>
                    <span />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>pending…</span>
                    <span />
                  </div>
                ))
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
  const [selectedRunId, setSelectedRunId] = useState<string | null>(group.runs[0]?.id ?? null);
  const c = agentColor(group.agentId);
  const active = group.runs.some(r => isActive(r.status));

  const cancelGroup = useMutation({
    mutationFn: () => testRunGroupsApi.cancel(group.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['test-run-groups'] }),
  });

  useTestRunGroupStream(
    active ? group.id : null,
    useCallback(() => qc.invalidateQueries({ queryKey: ['test-run-groups'] }), [qc]),
    useCallback(() => qc.invalidateQueries({ queryKey: ['test-run-groups'] }), [qc]),
  );

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => qc.invalidateQueries({ queryKey: ['test-run-groups'] }), 5000);
    return () => clearInterval(t);
  }, [active, qc]);

  const selectedRun = group.runs.find(r => r.id === selectedRunId) ?? group.runs[0] ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Group header */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
        <div style={{ height: 3, background: `linear-gradient(90deg, ${c}, ${c}44)` }} />
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{group.suiteName}</span>
              <span style={{ padding: '2px 8px', borderRadius: 100, background: c + '20', color: c, fontSize: 10.5, fontWeight: 600 }}>{group.agentName}</span>
              <span style={{ padding: '2px 7px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: `${statusColor(group.status)}18`, color: statusColor(group.status) }}>{group.status}</span>
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{fmtRelative(group.createdAt)} · {group.runs.length} run{group.runs.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {active && (
              <button onClick={() => cancelGroup.mutate()} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
            )}
          </div>
        </div>
      </div>

      {/* Run tabs (if multiple) */}
      {group.runs.length > 1 && (
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-card)', borderRadius: 10, boxShadow: 'var(--shadow-pill)', flexWrap: 'wrap' }}>
          {group.runs.map(run => {
            const isActive = selectedRunId === run.id;
            const mc = modelColor(run.endpointName);
            const rPassRate = run.totalCases > 0 ? Math.round((run.passedCases / run.totalCases) * 100) : null;
            return (
              <button key={run.id} onClick={() => setSelectedRunId(run.id)} style={{ flex: '1 1 auto', padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, background: isActive ? 'var(--bg-card-2)' : 'transparent', color: isActive ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: isActive ? 'var(--shadow-pill)' : 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: 2, background: mc }} />
                {run.endpointName}
                {rPassRate !== null && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: rPassRate >= 75 ? 'var(--success)' : rPassRate >= 55 ? 'var(--warn)' : 'var(--danger)', fontWeight: 700 }}>{rPassRate}%</span>}
              </button>
            );
          })}
        </div>
      )}

      {selectedRun && <RunDetail run={selectedRun} group={group} />}
    </div>
  );
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

export default function Runs() {
  const qc = useQueryClient();
  const [agentFilter, setAgentFilter] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['test-run-groups', agentFilter],
    queryFn: () => testRunGroupsApi.list({ agentId: agentFilter || undefined, pageSize: 100 }),
    refetchInterval: 15_000,
  });
  const { data: agentsData } = useQuery({ queryKey: ['agents'], queryFn: () => agentsApi.list({ pageSize: 200 }) });

  const groups = data?.items ?? [];
  const agents = agentsData?.items ?? [];

  const selectedGroup = groups.find(g => g.id === selectedGroupId) ?? groups[0] ?? null;
  const agentList = ['All', ...agents.map(a => a.name)];
  const agentIds = ['', ...agents.map(a => a.id)];

  const delGroup = useMutation({
    mutationFn: () => testRunGroupsApi.delete(deleteGroupId!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['test-run-groups'] }); setDeleteGroupId(null); if (deleteGroupId === selectedGroupId) setSelectedGroupId(null); },
  });

  const deleteTarget = groups.find(g => g.id === deleteGroupId);

  const totalRuns = groups.length;
  const avgPassRate = groups.filter(g => g.status === TestRunStatus.Completed).length > 0
    ? Math.round(groups.filter(g => g.status === TestRunStatus.Completed).reduce((n, g) => {
        const total = g.runs.reduce((s, r) => s + r.totalCases, 0);
        const passed = g.runs.reduce((s, r) => s + r.passedCases, 0);
        return n + (total > 0 ? passed / total : 0);
      }, 0) / groups.filter(g => g.status === TestRunStatus.Completed).length * 100)
    : null;

  return (
    <div style={{ width: '100%', maxWidth: 1360, margin: '0 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', padding: '4px 4px 24px' }}>
      {/* Header */}
      <div className="fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 6px' }}>Test Runs</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: 0 }}>Evaluation results over time — per-case pass/fail, scores, and trends.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'Total runs', value: String(totalRuns) },
            { label: 'Avg pass rate', value: avgPassRate !== null ? `${avgPassRate}%` : '—' },
          ].map(s => (
            <div key={s.label} style={{ padding: '10px 16px', background: 'var(--bg-card)', borderRadius: 12, boxShadow: 'var(--shadow-card)', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Master–detail */}
      <div className="fade-up" style={{ animationDelay: '40ms', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14, alignItems: 'start' }}>
        {/* Left: group list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Agent filter */}
          <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--bg-card)', borderRadius: 10, boxShadow: 'var(--shadow-pill)', flexWrap: 'wrap' }}>
            {agentList.map((a, i) => (
              <button key={a} onClick={() => setAgentFilter(agentIds[i])} style={{ flex: '1 1 auto', padding: '5px 8px', borderRadius: 7, fontSize: 10.5, fontWeight: 500, background: agentFilter === agentIds[i] ? 'var(--bg-card-2)' : 'transparent', color: agentFilter === agentIds[i] ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: agentFilter === agentIds[i] ? 'var(--shadow-pill)' : 'none', whiteSpace: 'nowrap' }}>
                {a}
              </button>
            ))}
          </div>

          {isLoading && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>}

          {/* Group cards */}
          {groups.map(group => {
            const isSelected = selectedGroup?.id === group.id;
            const c = agentColor(group.agentId);
            const totalCases = group.runs.reduce((s, r) => s + r.totalCases, 0);
            const passedCases = group.runs.reduce((s, r) => s + r.passedCases, 0);
            const passRate = totalCases > 0 ? Math.round((passedCases / totalCases) * 100) : null;
            const passColor = passRate !== null ? (passRate >= 75 ? 'var(--success)' : passRate >= 55 ? 'var(--warn)' : 'var(--danger)') : 'var(--text-muted)';
            return (
              <button
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                style={{ textAlign: 'left', width: '100%', background: 'var(--bg-card)', borderRadius: 13, padding: '12px 14px 12px 17px', boxShadow: isSelected ? `0 1px 0 rgba(255,255,255,0.07) inset, 0 0 0 1.5px ${c}55, 0 8px 24px -8px ${c}44` : 'var(--shadow-card)', transition: 'box-shadow 0.15s', position: 'relative', overflow: 'hidden', border: 'none', cursor: 'pointer' }}
              >
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: c, borderRadius: '13px 0 0 13px' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 10.5, color: isSelected ? 'var(--accent-hover)' : 'var(--text-muted)', fontWeight: 600 }}>{group.id.slice(0, 8)}…</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{fmtRelative(group.createdAt)}</span>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteGroupId(group.id); }}
                      style={{ fontSize: 12, color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 2px' }}
                    >🗑</button>
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
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-card)', borderRadius: 14, boxShadow: 'var(--shadow-card)' }}>
              No test runs yet. Run a suite to get started.
            </div>
          )}
        </div>

        {/* Right: detail */}
        <div>
          {selectedGroup
            ? <GroupDetail key={selectedGroup.id} group={selectedGroup} />
            : <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-card)', borderRadius: 14, boxShadow: 'var(--shadow-card)' }}>Select a run to see details.</div>
          }
        </div>
      </div>

      {deleteGroupId && deleteTarget && (
        <ConfirmDialog entityName={deleteTarget.suiteName} onConfirm={() => delGroup.mutate()} onCancel={() => setDeleteGroupId(null)} loading={delGroup.isPending} />
      )}
    </div>
  );
}
