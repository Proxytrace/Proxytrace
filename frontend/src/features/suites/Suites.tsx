import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { testSuitesApi } from '../../api/test-suites';
import { testRunGroupsApi } from '../../api/test-run-groups';
import { TrashIcon, XIcon, EditIcon } from '../../components/icons';
import { agentsApi } from '../../api/agents';
import { evaluatorsApi } from '../../api/evaluators';
import { agentCallsApi } from '../../api/agent-calls';
import { QUERY_KEYS } from '../../api/query-keys';
import { useCurrentProject } from '../../contexts/ProjectContext';
import type { AgentCallDto, EvaluatorDetailDto, TestSuiteDto } from '../../api/models';
import { Modal } from '../../components/overlays/Modal';
import { ModalFooter } from '../../components/overlays/Modal';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { StepWizard } from '../../components/overlays/StepWizard';
import { agentColor, EVALUATOR_KIND_COLOR } from '../../lib/colors';
import { fmtRelative, fmtDate } from '../../lib/format';
import { ColoredBadge } from '../../components/ui/ColoredBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { sparklinePath } from '../../lib/charts';
import { RunConfirmModal } from './RunConfirmModal';
import { useToast } from '../../components/ui/Toast';
import { useFilter } from '../../hooks/useFilter';
import { PASS_RATE_WARN, PASS_RATE_DANGER, LIST_PAGE_SIZE } from '../../lib/constants';
import { AgentStep, NameStep, TracesStep, EvaluatorsStep } from './CreateSuiteWizard';

// ─── SuiteCard ────────────────────────────────────────────────────────────────

function SuiteCard({ suite, onRun, onEdit, onDelete }: {
  suite: TestSuiteDto;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const c = agentColor(suite.agentId);
  const hasRuns = suite.totalRuns > 0;
  const passColor = suite.passRate === null
    ? 'var(--text-muted)'
    : suite.passRate >= PASS_RATE_WARN ? 'var(--success)'
    : suite.passRate >= PASS_RATE_DANGER ? 'var(--warn)'
    : 'var(--danger)';
  const delta = suite.passRate !== null && suite.prevPassRate !== null ? suite.passRate - suite.prevPassRate : null;

  return (
    <div
      style={{ background: 'var(--bg-card)', borderRadius: 16, boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', transition: 'box-shadow 0.18s' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 1px 0 rgba(255,255,255,0.06) inset, 0 4px 20px rgba(0,0,0,0.45), 0 0 0 1px ${c}40`)}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow-card)')}
    >
      <div style={{ height: 3, background: `linear-gradient(90deg, ${c}, ${c}44)` }} />
      <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>{suite.name}</span>
              {!hasRuns && (
                <span style={{ padding: '2px 7px', background: 'var(--warn-subtle)', color: 'var(--warn)', borderRadius: 100, fontSize: 10, fontWeight: 600 }}>No runs yet</span>
              )}
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 100, background: c + '20', color: c, fontSize: 10.5, fontWeight: 600, boxShadow: 'var(--shadow-pill)' }}>
              {suite.agentName}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button
              onClick={onRun}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff', boxShadow: '0 4px 14px -6px rgba(139,92,246,0.6), inset 0 1px 0 rgba(255,255,255,0.15)', whiteSpace: 'nowrap' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              ▶ {hasRuns ? 'Run again' : 'Run now'}
            </button>
            <button onClick={onEdit} className="btn-icon"><EditIcon size={13} /></button>
            <button onClick={onDelete} className="btn-icon btn-icon-danger"><TrashIcon size={13} /></button>
          </div>
        </div>

        {/* Description */}
        {suite.description && (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55, margin: 0 }}>{suite.description}</p>
        )}

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {/* Pass rate */}
          <div style={{ padding: '10px 12px', background: 'var(--bg-card-2)', borderRadius: 10, boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Pass rate</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: passColor, letterSpacing: '-0.02em' }}>
                {suite.passRate !== null ? `${Math.round(suite.passRate)}%` : '—'}
              </span>
              {delta !== null && (
                <span style={{ fontSize: 11, fontWeight: 600, color: delta >= 0 ? 'var(--success)' : 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  {delta >= 0 ? '↗' : '↘'}{Math.abs(Math.round(delta))}pt
                </span>
              )}
            </div>
            {hasRuns && suite.passRateTrend.length >= 2 && (
              <svg width={80} height={20} style={{ display: 'block', marginTop: 4, overflow: 'visible' }}>
                <path d={sparklinePath(suite.passRateTrend, 80, 20)} fill="none" stroke={passColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
              </svg>
            )}
          </div>

          {/* Test cases */}
          <div style={{ padding: '10px 12px', background: 'var(--bg-card-2)', borderRadius: 10, boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Test cases</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{suite.testCases.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{suite.totalRuns} run{suite.totalRuns !== 1 ? 's' : ''} total</div>
          </div>

          {/* Last run */}
          <div style={{ padding: '10px 12px', background: 'var(--bg-card-2)', borderRadius: 10, boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Last run</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: hasRuns ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: 2 }}>
              {suite.lastRunAt ? fmtRelative(suite.lastRunAt) : 'Never'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
              {suite.lastRunGroupId ? suite.lastRunGroupId.slice(0, 8) : 'Not yet run'}
            </div>
          </div>
        </div>

        {/* Evaluator badges + tags */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          {suite.evaluators.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {suite.evaluators.map(e => (
                <ColoredBadge key={e.id} color={EVALUATOR_KIND_COLOR[e.kind]} label={e.kind} shape="rounded" />
              ))}
            </div>
          )}
          {suite.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {suite.tags.map(t => (
                <span key={t} style={{ padding: '2px 8px', background: 'var(--bg-card-2)', color: 'var(--text-muted)', borderRadius: 5, fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace" }}>#{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--hairline)', fontSize: 11, color: 'var(--text-muted)' }}>
          <span>Created {fmtDate(suite.createdAt)}</span>
          <button style={{ fontSize: 11.5, color: 'var(--accent-hover)', fontWeight: 500 }} onClick={onEdit}>View cases ›</button>
        </div>
      </div>
    </div>
  );
}

// ─── Suites ───────────────────────────────────────────────────────────────────

export default function Suites() {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;
  const enabled = currentProjectId !== null;
  const [runSuite, setRunSuite] = useState<TestSuiteDto | null>(null);
  const [runDone, setRunDone] = useState(false);
  const [editSuite, setEditSuite] = useState<TestSuiteDto | null>(null);
  const [editTab, setEditTab] = useState<'cases' | 'evaluators'>('cases');
  const [deleteSuite, setDeleteSuite] = useState<TestSuiteDto | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(0);
  const [createAgentId, setCreateAgentId] = useState('');
  const [createName, setCreateName] = useState('');
  const [selectedCalls, setSelectedCalls] = useState<Set<string>>(new Set());
  const [selectedEvaluatorIds, setSelectedEvaluatorIds] = useState<Set<string>>(new Set());
  const [addedTraceIds, setAddedTraceIds] = useState<Set<string>>(new Set());

  const { data: suitesData, isLoading } = useQuery({
    queryKey: QUERY_KEYS.testSuites(undefined, projectId),
    queryFn: () => testSuitesApi.list({ projectId, pageSize: LIST_PAGE_SIZE }),
    enabled,
  });
  const { data: agentsData } = useQuery({
    queryKey: QUERY_KEYS.agents(projectId),
    queryFn: () => agentsApi.list({ projectId, pageSize: LIST_PAGE_SIZE }),
    enabled,
  });
  const { data: evaluators = [] } = useQuery({
    queryKey: QUERY_KEYS.evaluators(projectId),
    queryFn: () => evaluatorsApi.list({ projectId }),
    enabled,
  });
  const { data: editTracesData } = useQuery({
    queryKey: QUERY_KEYS.agentCallsForSuiteEdit(editSuite?.agentId),
    queryFn: () => agentCallsApi.list({ agentId: editSuite?.agentId, pageSize: 50 }),
    enabled: !!editSuite && editTab === 'cases',
  });

  const suites = suitesData?.items ?? [];
  const agents = agentsData?.items ?? [];
  const editTraces = editTracesData?.items ?? [];

  const { filter: agentFilter, setFilter: setAgentFilter, filtered: visibleSuites } = useFilter(
    suites,
    (s, id: string) => !id || s.agentId === id,
    '',
  );

  const totalCases = suites.reduce((n, s) => n + s.testCases.length, 0);
  const totalRuns = suites.reduce((n, s) => n + s.totalRuns, 0);
  const suitesWithPassRate = suites.filter(s => s.passRate !== null);
  const avgPassRate = suitesWithPassRate.length > 0
    ? Math.round(suitesWithPassRate.reduce((n, s) => n + s.passRate!, 0) / suitesWithPassRate.length)
    : null;

  const startRun = useMutation({
    mutationFn: (endpointIds: string[]) => testRunGroupsApi.create(runSuite!.id, endpointIds),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['test-run-groups'] }); setRunDone(true); },
    onError: (err) => toast((err as Error).message || 'Failed to start run', 'error'),
  });

  const delSuite = useMutation({
    mutationFn: () => testSuitesApi.delete(deleteSuite!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['test-suites'] }); setDeleteSuite(null); },
    onError: (err) => toast((err as Error).message || 'Failed to delete suite', 'error'),
  });

  const addCase = useMutation({
    mutationFn: (callId: string) => testSuitesApi.addTestCase(editSuite!.id, callId),
    onSuccess: (updatedSuite, callId) => {
      qc.invalidateQueries({ queryKey: ['test-suites'] });
      setEditSuite(updatedSuite);
      setAddedTraceIds(prev => new Set([...prev, callId]));
    },
    onError: (err) => toast((err as Error).message || 'Failed to add test case', 'error'),
  });

  const removeCase = useMutation({
    mutationFn: (caseId: string) => testSuitesApi.removeTestCase(editSuite!.id, caseId),
    onSuccess: (_, caseId) => {
      qc.invalidateQueries({ queryKey: ['test-suites'] });
      setEditSuite(prev => prev ? { ...prev, testCases: prev.testCases.filter(tc => tc.id !== caseId) } : prev);
    },
    onError: (err) => toast((err as Error).message || 'Failed to remove test case', 'error'),
  });

  const saveEvaluators = useMutation({
    mutationFn: () => testSuitesApi.updateEvaluators(editSuite!.id, Array.from(selectedEvaluatorIds)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['test-suites'] }); setEditSuite(null); },
    onError: (err) => toast((err as Error).message || 'Failed to save evaluators', 'error'),
  });

  const createSuite = useMutation({
    mutationFn: () => testSuitesApi.create({ name: createName, agentId: createAgentId, agentCallIds: Array.from(selectedCalls), evaluatorIds: Array.from(selectedEvaluatorIds) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['test-suites'] }); setCreateOpen(false); resetCreate(); },
    onError: (err) => toast((err as Error).message || 'Failed to create suite', 'error'),
  });

  function resetCreate() { setCreateStep(0); setCreateAgentId(''); setCreateName(''); setSelectedCalls(new Set()); setSelectedEvaluatorIds(new Set()); }

  function openEdit(suite: TestSuiteDto) {
    setEditSuite(suite);
    setEditTab('cases');
    setSelectedEvaluatorIds(new Set(suite.evaluators.map(e => e.id)));
    setAddedTraceIds(new Set());
  }

  function closeRunModal() { setRunSuite(null); setRunDone(false); }

  // Agent filter tabs
  const agentList = [{ id: '', name: 'All', count: suites.length }, ...agents.map(a => ({ id: a.id, name: a.name, count: suites.filter(s => s.agentId === a.id).length }))];

  function toggleSelectedCall(id: string) {
    setSelectedCalls(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }
  function toggleEvaluator(id: string) {
    setSelectedEvaluatorIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  const wizardSteps = [
    {
      label: 'Select agent',
      content: <AgentStep agents={agents} value={createAgentId} onChange={setCreateAgentId} />,
    },
    {
      label: 'Name suite',
      content: <NameStep value={createName} onChange={setCreateName} />,
    },
    {
      label: 'Select traces',
      content: (
        <TracesStep
          agentId={createAgentId}
          selected={selectedCalls}
          onToggle={toggleSelectedCall}
          onClear={() => setSelectedCalls(new Set())}
        />
      ),
    },
    {
      label: 'Select evaluators',
      content: (
        <EvaluatorsStep
          evaluators={evaluators as EvaluatorDetailDto[]}
          selectedIds={selectedEvaluatorIds}
          onToggle={toggleEvaluator}
        />
      ),
    },
  ];

  const canAdvanceCreate = ([!!createAgentId, !!createName.trim(), selectedCalls.size > 0, true] as boolean[])[createStep] ?? false;

  return (
    <div className="w-full max-w-[1480px] mx-auto min-w-0 flex flex-col gap-4 overflow-y-auto pb-6">
      {/* KPI row */}
      <div className="fade-up grid gap-3" style={{ animationDelay: '30ms', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'Total suites',  value: suites.length,                                          sub: `across ${new Set(suites.map(s => s.agentId)).size} agents`, color: '#8b5cf6' },
          { label: 'Total cases',   value: totalCases,                                             sub: 'test case inputs',                                           color: '#06b6d4' },
          { label: 'Total runs',    value: totalRuns,                                              sub: 'evaluations run',                                            color: '#10b981' },
          { label: 'Avg pass rate', value: avgPassRate !== null ? `${avgPassRate}%` : '—',         sub: 'across all suites',                                          color: '#f59e0b' },
        ].map(k => (
          <div key={k.label} className="bg-card rounded-[14px] px-[18px] py-4 flex items-center gap-[14px]" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="w-10 h-10 rounded-[11px] flex items-center justify-center shrink-0" style={{ background: k.color + '18' }}>
              <span className="font-mono text-[18px] font-[800] tracking-[-0.04em]" style={{ color: k.color }}>{k.value}</span>
            </div>
            <div>
              <div className="text-[13px] font-semibold">{k.label}</div>
              <div className="text-[11.5px] text-muted mt-[1px]">{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Agent filter tabs */}
      <div className="fade-up flex items-center gap-6" style={{ animationDelay: '60ms' }}>
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-card)', borderRadius: 11, boxShadow: 'var(--shadow-pill)', flexWrap: 'wrap' }}>
          {agentList.map(a => {
            const isActive = agentFilter === a.id;
            const c = a.id ? agentColor(a.id) : undefined;
            return (
              <button key={a.id} onClick={() => setAgentFilter(a.id)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 7, background: isActive ? 'var(--bg-card-2)' : 'transparent', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', boxShadow: isActive ? '0 1px 0 rgba(255,255,255,0.06) inset, 0 1px 2px rgba(0,0,0,0.25)' : 'none' }}>
                {c && <span style={{ width: 7, height: 7, borderRadius: 2, background: c, opacity: isActive ? 1 : 0.5 }} />}
                {a.name}
                <span style={{ padding: '1px 6px', background: isActive ? 'rgba(139,92,246,0.18)' : 'var(--bg-card)', color: isActive ? '#c4b5fd' : 'var(--text-muted)', borderRadius: 100, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{a.count}</span>
              </button>
            );
          })}
        </div>
        <span className="text-[12px] text-muted">{visibleSuites.length} suite{visibleSuites.length !== 1 ? 's' : ''}</span>
        <button
          onClick={() => { setCreateOpen(true); resetCreate(); }}
          className="btn-primary inline-flex items-center gap-[7px] whitespace-nowrap ml-auto"
        >
          + New suite
        </button>
      </div>

      {isLoading && <div className="text-center p-[60px] text-muted text-[13px]">Loading…</div>}

      {/* Suite grid */}
      <div className="fade-up grid gap-[14px]" style={{ animationDelay: '100ms', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
        {visibleSuites.map(suite => (
          <SuiteCard
            key={suite.id}
            suite={suite}
            onRun={() => { setRunSuite(suite); setRunDone(false); }}
            onEdit={() => openEdit(suite)}
            onDelete={() => setDeleteSuite(suite)}
          />
        ))}
        {!isLoading && visibleSuites.length === 0 && (
          <div className="col-span-full">
            <EmptyState title="No test suites yet" description="Create one to start evaluating." />
          </div>
        )}
      </div>

      {/* Run confirm modal */}
      {runSuite && (
        <RunConfirmModal
          suite={runSuite}
          onClose={closeRunModal}
          onSubmit={ids => startRun.mutate(ids)}
          loading={startRun.isPending}
          done={runDone}
        />
      )}

      {/* Edit modal */}
      {editSuite && (
        <Modal
          title={`Edit "${editSuite.name}"`}
          onClose={() => setEditSuite(null)}
          maxWidth={600}
          footer={
            editTab === 'evaluators' ? (
              <ModalFooter
                onCancel={() => setEditSuite(null)}
                onSubmit={() => saveEvaluators.mutate()}
                submitLabel={saveEvaluators.isPending ? 'Saving…' : 'Save evaluators'}
                loading={saveEvaluators.isPending}
              />
            ) : (
              <button className="btn-ghost" onClick={() => setEditSuite(null)}>Close</button>
            )
          }
        >
          <div className="flex border-b border-hairline mb-4 -mb-px">
            {(['cases', 'evaluators'] as const).map(t => (
              <button key={t} onClick={() => setEditTab(t)} className={`px-4 py-2 text-[13px] font-semibold border-none cursor-pointer bg-transparent -mb-px ${editTab === t ? 'text-accent border-b-2 border-b-accent' : 'text-muted border-b-2 border-b-transparent'}`}>
                {t === 'cases' ? `Test Cases (${editSuite.testCases.length})` : 'Evaluators'}
              </button>
            ))}
          </div>
          {editTab === 'cases' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Current test cases */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                  {editSuite.testCases.length} test case{editSuite.testCases.length !== 1 ? 's' : ''}
                </div>
                {editSuite.testCases.length === 0 ? (
                  <div style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5, background: 'var(--bg-card-2)', borderRadius: 8, border: '1px dashed var(--border-color)' }}>
                    No test cases yet — add traces below to get started.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {editSuite.testCases.map(tc => {
                      const preview = [...tc.input].reverse().find(m => m.role === 'user')?.content ?? tc.input[tc.input.length - 1]?.content;
                      const isRemoving = removeCase.isPending && removeCase.variables === tc.id;
                      return (
                        <div key={tc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, background: 'var(--bg-card-2)', border: '1px solid var(--border-color)', opacity: isRemoving ? 0.5 : 1, transition: 'opacity 0.15s' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {preview?.slice(0, 80) || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No user message</span>}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                              {tc.input.length} message{tc.input.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                          <button
                            onClick={() => removeCase.mutate(tc.id)}
                            disabled={isRemoving}
                            className="btn-icon btn-icon-danger"
                            title="Remove test case"
                          >
                            <XIcon size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--hairline)' }} />

              {/* Add from traces */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                  Add from traces
                </div>
                {editTracesData === undefined ? (
                  <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>Loading traces…</div>
                ) : (() => {
                  const available = editTraces.filter((t: AgentCallDto) => !addedTraceIds.has(t.id));
                  if (available.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '14px 16px', color: 'var(--text-muted)', fontSize: 12.5, background: 'var(--bg-card-2)', borderRadius: 8, border: '1px dashed var(--border-color)' }}>
                        {editTraces.length === 0 ? 'No traces found for this agent.' : 'All available traces have been added.'}
                      </div>
                    );
                  }
                  return (
                    <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {available.map((t: AgentCallDto) => {
                        const lastMsg = [...t.request].reverse().find(m => m.role === 'user');
                        const isAdding = addCase.isPending && addCase.variables === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => addCase.mutate(t.id)}
                            disabled={isAdding}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '9px 12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-color)', cursor: isAdding ? 'default' : 'pointer', opacity: isAdding ? 0.65 : 1, transition: 'border-color 0.15s, background 0.15s' }}
                            onMouseEnter={e => { if (!isAdding) { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'; e.currentTarget.style.background = 'var(--accent-subtle)'; } }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = 'var(--bg-card)'; }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                <span style={{ fontSize: 12, fontWeight: 600 }}>{t.model}</span>
                                <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{fmtRelative(t.createdAt)}</span>
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {lastMsg?.content?.slice(0, 60) ?? <span className="mono" style={{ fontSize: 10.5 }}>{t.id.slice(0, 12)}…</span>}
                              </div>
                            </div>
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: isAdding ? 'var(--text-muted)' : 'var(--accent)', flexShrink: 0 }}>
                              {isAdding ? '…' : '+ Add'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
          {editTab === 'evaluators' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(evaluators as EvaluatorDetailDto[]).map(e => {
                const c = EVALUATOR_KIND_COLOR[e.kind];
                return (
                  <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: selectedEvaluatorIds.has(e.id) ? `${c}14` : 'var(--bg-card-2)', border: `1px solid ${selectedEvaluatorIds.has(e.id) ? `${c}44` : 'var(--border-color)'}`, cursor: 'pointer' }}>
                    <input type="checkbox" checked={selectedEvaluatorIds.has(e.id)} onChange={ev => { const s = new Set(selectedEvaluatorIds); if (ev.target.checked) s.add(e.id); else s.delete(e.id); setSelectedEvaluatorIds(s); }} />
                    <ColoredBadge color={c} label={e.kind} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{e.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </Modal>
      )}

      {/* Create wizard */}
      {createOpen && (
        <Modal title="Create Test Suite" onClose={() => { setCreateOpen(false); resetCreate(); }} size="xl">
          <StepWizard
            steps={wizardSteps}
            currentStep={createStep}
            onNext={() => setCreateStep(s => s + 1)}
            onBack={() => setCreateStep(s => s - 1)}
            onSubmit={() => createSuite.mutate()}
            canAdvance={canAdvanceCreate}
            submitLabel="Create suite"
            loading={createSuite.isPending}
          />
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteSuite && (
        <ConfirmDialog entityName={deleteSuite.name} onConfirm={() => delSuite.mutate()} onCancel={() => setDeleteSuite(null)} loading={delSuite.isPending} />
      )}
    </div>
  );
}
