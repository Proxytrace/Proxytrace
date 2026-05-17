import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { testSuitesApi } from '../../api/test-suites';
import { testRunGroupsApi } from '../../api/test-run-groups';
import { TrashIcon, EditIcon } from '../../components/icons';
import { agentsApi } from '../../api/agents';
import { evaluatorsApi } from '../../api/evaluators';
import { QUERY_KEYS } from '../../api/query-keys';
import useCurrentProject from '../../hooks/useCurrentProject';
import type { EvaluatorDetailDto, TestSuiteDto } from '../../api/models';
import { Modal } from '../../components/overlays/Modal';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { StepWizard } from '../../components/overlays/StepWizard';
import { agentColor, EVALUATOR_KIND_COLOR } from '../../lib/colors';
import { fmtRelative, fmtDate } from '../../lib/format';
import { ColoredBadge } from '../../components/ui/ColoredBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { sparklinePath } from '../../lib/charts';
import { RunConfirmModal } from './RunConfirmModal';
import { EditSuiteDialog } from './EditSuiteDialog';
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
      style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', transition: 'box-shadow 0.18s' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 1px 0 rgba(255,255,255,0.06) inset, 0 4px 20px rgba(0,0,0,0.45), 0 0 0 1px color-mix(in srgb, ${c} 25%, transparent)`)}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow-card)')}
    >
      <div style={{ height: 3, background: `linear-gradient(90deg, ${c}, color-mix(in srgb, ${c} 28%, transparent))` }} />
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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 100, background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c, fontSize: 10.5, fontWeight: 600, boxShadow: 'var(--shadow-pill)', border: `1px solid color-mix(in srgb, ${c} 32%, transparent)` }}>
              {suite.agentName}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button
              onClick={onRun}
              data-write
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-md)', fontSize: 12.5, fontWeight: 600, background: 'var(--grad-accent)', color: '#fff', boxShadow: 'var(--shadow-btn)', whiteSpace: 'nowrap' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              ▶ {hasRuns ? 'Run again' : 'Run now'}
            </button>
            <button onClick={onEdit} data-write className="btn-icon"><EditIcon size={13} /></button>
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
          <div style={{ padding: '10px 12px', background: 'var(--bg-card-2)', borderRadius: 'var(--radius-md)', boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset' }}>
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
          <div style={{ padding: '10px 12px', background: 'var(--bg-card-2)', borderRadius: 'var(--radius-md)', boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Test cases</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{suite.testCases.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{suite.totalRuns} run{suite.totalRuns !== 1 ? 's' : ''} total</div>
          </div>

          {/* Last run */}
          <div style={{ padding: '10px 12px', background: 'var(--bg-card-2)', borderRadius: 'var(--radius-md)', boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset' }}>
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
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;
  const enabled = currentProjectId !== null;
  const [runSuite, setRunSuite] = useState<TestSuiteDto | null>(null);
  const [runDone, setRunDone] = useState(false);
  const [editSuite, setEditSuite] = useState<TestSuiteDto | null>(null);
  const [deleteSuite, setDeleteSuite] = useState<TestSuiteDto | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(0);
  const [createAgentId, setCreateAgentId] = useState('');
  const [createName, setCreateName] = useState('');
  const [selectedCalls, setSelectedCalls] = useState<Set<string>>(new Set());
  const [selectedEvaluatorIds, setSelectedEvaluatorIds] = useState<Set<string>>(new Set());

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

  const suites = suitesData?.items ?? [];
  const agents = agentsData?.items ?? [];

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
  });

  const delSuite = useMutation({
    mutationFn: () => testSuitesApi.delete(deleteSuite!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['test-suites'] }); setDeleteSuite(null); },
  });

  const createSuite = useMutation({
    mutationFn: () => testSuitesApi.create({ name: createName, agentId: createAgentId, agentCallIds: Array.from(selectedCalls), evaluatorIds: Array.from(selectedEvaluatorIds) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['test-suites'] }); setCreateOpen(false); resetCreate(); },
  });

  function resetCreate() { setCreateStep(0); setCreateAgentId(''); setCreateName(''); setSelectedCalls(new Set()); setSelectedEvaluatorIds(new Set()); }

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
    <div className="w-full min-w-0 flex flex-col gap-4">
      {/* KPI row */}
      <div className="fade-up grid gap-3" style={{ animationDelay: '30ms', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'Total suites',  value: suites.length,                                          sub: `across ${new Set(suites.map(s => s.agentId)).size} agents`, color: 'var(--accent-primary)' },
          { label: 'Total cases',   value: totalCases,                                             sub: 'test case inputs',                                           color: 'var(--teal)' },
          { label: 'Total runs',    value: totalRuns,                                              sub: 'evaluations run',                                            color: 'var(--success)' },
          { label: 'Avg pass rate', value: avgPassRate !== null ? `${avgPassRate}%` : '—',         sub: 'across all suites',                                          color: 'var(--warn)' },
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
                <span style={{ padding: '1px 6px', background: isActive ? 'var(--accent-subtle)' : 'var(--bg-card)', color: isActive ? 'var(--accent-hover)' : 'var(--text-muted)', borderRadius: 100, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{a.count}</span>
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

      {isLoading && (
        <div className="grid gap-[14px]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height={220} className="rounded-lg" />
          ))}
        </div>
      )}

      {/* Suite grid */}
      <div className="fade-up grid gap-[14px]" style={{ animationDelay: '100ms', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
        {visibleSuites.map(suite => (
          <SuiteCard
            key={suite.id}
            suite={suite}
            onRun={() => { setRunSuite(suite); setRunDone(false); }}
            onEdit={() => setEditSuite(suite)}
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

      {/* Edit dialog */}
      {editSuite && (
        <EditSuiteDialog
          suite={editSuite}
          projectId={projectId}
          onClose={() => setEditSuite(null)}
        />
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
