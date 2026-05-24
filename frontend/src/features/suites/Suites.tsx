import { useState } from 'react';
import type { EvaluatorDetailDto, TestSuiteDto } from '../../api/models';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/overlays/Modal';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { StepWizard } from '../../components/overlays/StepWizard';
import { agentColor } from '../../lib/colors';
import { useFilter } from '../../hooks/useFilter';
import { AgentStep, NameStep, TracesStep, EvaluatorsStep } from './CreateSuiteWizard';
import { RunConfirmModal } from './RunConfirmModal';
import { EditSuiteDialog } from './EditSuiteDialog';
import { SuiteCard } from './components/SuiteCard';
import { useSuites, useSuiteAgents, useSuiteEvaluators } from './hooks/useSuiteQueries';
import { useStartRun, useDeleteSuite, useCreateSuite } from './hooks/useSuiteMutations';
import { computeSuiteStats } from './suitesMeta';

export default function Suites() {
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

  const { suites, isLoading, projectId } = useSuites();
  const { agents } = useSuiteAgents();
  const { evaluators } = useSuiteEvaluators();

  const startRun = useStartRun(() => setRunDone(true));
  const delSuite = useDeleteSuite(() => setDeleteSuite(null));
  const createSuite = useCreateSuite(() => { setCreateOpen(false); resetCreate(); });

  const { filter: agentFilter, setFilter: setAgentFilter, filtered: visibleSuites } = useFilter(
    suites,
    (s, id: string) => !id || s.agentId === id,
    '',
  );

  const { totalCases, totalRuns, avgPassRate } = computeSuiteStats(suites);

  function resetCreate() {
    setCreateStep(0);
    setCreateAgentId('');
    setCreateName('');
    setSelectedCalls(new Set());
    setSelectedEvaluatorIds(new Set());
  }

  function closeRunModal() { setRunSuite(null); setRunDone(false); }

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

  const agentList = [
    { id: '', name: 'All', count: suites.length },
    ...agents.map(a => ({ id: a.id, name: a.name, count: suites.filter(s => s.agentId === a.id).length })),
  ];

  const canAdvanceCreate =
    ([!!createAgentId, !!createName.trim(), selectedCalls.size > 0, true] as boolean[])[createStep] ?? false;

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

  const kpiItems = [
    { label: 'Total suites',  value: suites.length,                                  sub: `across ${new Set(suites.map(s => s.agentId)).size} agents`, color: 'var(--accent-primary)' },
    { label: 'Total cases',   value: totalCases,                                      sub: 'test case inputs',                                           color: 'var(--teal)' },
    { label: 'Total runs',    value: totalRuns,                                       sub: 'evaluations run',                                            color: 'var(--success)' },
    { label: 'Avg pass rate', value: avgPassRate !== null ? `${avgPassRate}%` : '—', sub: 'across all suites',                                          color: 'var(--warn)' },
  ];

  return (
    <div className="w-full min-w-0 flex flex-col gap-4">
      {/* KPI row */}
      <div className="fade-up grid gap-3 [animation-delay:30ms] grid-cols-4">
        {kpiItems.map(k => (
          <div key={k.label} className="bg-card rounded-[14px] px-[18px] py-4 flex items-center gap-[14px] shadow-[var(--shadow-card)]">
            <div
              className="w-10 h-10 rounded-[11px] flex items-center justify-center shrink-0"
              style={{ background: `${k.color}18` }}
            >
              <span className="font-mono text-[18px] font-[800] tracking-[-0.04em]" style={{ color: k.color }}>
                {k.value}
              </span>
            </div>
            <div>
              <div className="text-title font-semibold">{k.label}</div>
              <div className="text-[11.5px] text-muted mt-[1px]">{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Agent filter tabs */}
      <div className="fade-up flex items-center gap-6 [animation-delay:60ms]">
        <div className="flex gap-1 p-1 bg-card rounded-[11px] shadow-[var(--shadow-pill)] flex-wrap">
          {agentList.map(a => {
            const isActive = agentFilter === a.id;
            const c = a.id ? agentColor(a.id) : undefined;
            return (
              <button
                key={a.id}
                onClick={() => setAgentFilter(a.id)}
                className="px-[14px] py-[7px] rounded-lg text-[12.5px] font-medium inline-flex items-center gap-[7px]"
                style={{
                  background: isActive ? 'var(--bg-card-2)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: isActive ? '0 1px 0 rgba(255,255,255,0.06) inset, 0 1px 2px rgba(0,0,0,0.25)' : 'none',
                }}
              >
                {c && (
                  <span
                    className="w-[7px] h-[7px] rounded-[2px]"
                    style={{ background: c, opacity: isActive ? 1 : 0.5 }}
                  />
                )}
                {a.name}
                <span
                  className="px-[6px] py-[1px] rounded-full text-caption font-mono font-semibold"
                  style={{
                    background: isActive ? 'var(--accent-subtle)' : 'var(--bg-card)',
                    color: isActive ? 'var(--accent-hover)' : 'var(--text-muted)',
                  }}
                >
                  {a.count}
                </span>
              </button>
            );
          })}
        </div>
        <span className="text-body text-muted">
          {visibleSuites.length} suite{visibleSuites.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => { setCreateOpen(true); resetCreate(); }}
          className="btn-primary inline-flex items-center gap-[7px] whitespace-nowrap ml-auto"
        >
          + New suite
        </button>
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="grid gap-[14px] grid-cols-[repeat(auto-fill,minmax(380px,1fr))]">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height={220} className="rounded-lg" />
          ))}
        </div>
      )}

      {/* Suite grid */}
      <div className="fade-up grid gap-[14px] [animation-delay:100ms] grid-cols-[repeat(auto-fill,minmax(380px,1fr))]">
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
          onSubmit={ids => startRun.mutate({ suiteId: runSuite.id, endpointIds: ids })}
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
            onSubmit={() => createSuite.mutate({ name: createName, agentId: createAgentId, agentCallIds: Array.from(selectedCalls), evaluatorIds: Array.from(selectedEvaluatorIds) })}
            canAdvance={canAdvanceCreate}
            submitLabel="Create suite"
            loading={createSuite.isPending}
          />
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteSuite && (
        <ConfirmDialog
          entityName={deleteSuite.name}
          onConfirm={() => delSuite.mutate(deleteSuite.id)}
          onCancel={() => setDeleteSuite(null)}
          loading={delSuite.isPending}
        />
      )}
    </div>
  );
}
