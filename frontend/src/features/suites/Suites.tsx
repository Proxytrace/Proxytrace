import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { EvaluatorDetailDto, TestSuiteDto } from '../../api/models';
import { EmptyState } from '../../components/ui/EmptyState';
import { FilterDropdown, type FilterDropdownOption } from '../../components/ui/FilterDropdown';
import { Skeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/overlays/Modal';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { StepWizard } from '../../components/overlays/StepWizard';
import { Button } from '../../components/ui/Button';
import { agentColor } from '../../lib/colors';
import { useFilter } from '../../hooks/useFilter';
import { AgentStep, NameStep, TracesStep, EvaluatorsStep } from './CreateSuiteWizard';
import { RunConfirmModal } from './RunConfirmModal';
import { EditSuiteDialog } from './EditSuiteDialog';
import { SuiteCard } from './components/SuiteCard';
import { useSuites, useSuiteAgents, useSuiteEvaluators } from './hooks/useSuiteQueries';
import { useStartRun, useDeleteSuite, useCreateSuite } from './hooks/useSuiteMutations';
import { useSuiteFocus } from './hooks/useSuiteFocus';
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

  // Deep-link from the agent detail view: ?agentId pre-filters, ?suiteId scrolls + highlights.
  const [searchParams] = useSearchParams();
  const initialAgentFilter = searchParams.get('agentId') ?? '';
  const highlightSuiteId = useSuiteFocus(!isLoading);

  const startRun = useStartRun(() => setRunDone(true));
  const delSuite = useDeleteSuite(() => setDeleteSuite(null));
  const createSuite = useCreateSuite(() => { setCreateOpen(false); resetCreate(); });

  const { filter: agentFilter, setFilter: setAgentFilter, filtered: visibleSuites } = useFilter(
    suites,
    (s, id: string) => !id || s.agentId === id,
    initialAgentFilter,
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

  function selectAllCalls(ids: string[]) {
    setSelectedCalls(prev => {
      const s = new Set(prev);
      ids.forEach(id => s.add(id));
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

  // Only agents that actually own a suite are offered as filter options — a flat
  // dropdown scales to many agents where wrapping pill tabs did not.
  const agentFilterOptions = useMemo<FilterDropdownOption[]>(() => {
    const byAgent = new Map<string, { name: string; count: number }>();
    for (const s of suites) {
      const existing = byAgent.get(s.agentId);
      if (existing) existing.count += 1;
      else byAgent.set(s.agentId, { name: s.agentName, count: 1 });
    }
    return [
      { key: '', label: `All agents (${suites.length})` },
      ...Array.from(byAgent, ([id, { name, count }]) => ({
        key: id,
        label: `${name} (${count})`,
        accent: agentColor(id),
      })),
    ];
  }, [suites]);

  const canAdvanceCreate =
    ([!!createAgentId, selectedCalls.size > 0, !!createName.trim(), true] as boolean[])[createStep] ?? false;

  const wizardSteps = [
    {
      label: 'Select agent',
      content: <AgentStep agents={agents} value={createAgentId} onChange={setCreateAgentId} />,
    },
    {
      label: 'Select traces',
      content: (
        <TracesStep
          agentId={createAgentId}
          selected={selectedCalls}
          onToggle={toggleSelectedCall}
          onSelectAll={selectAllCalls}
          onClear={() => setSelectedCalls(new Set())}
        />
      ),
    },
    {
      label: 'Name suite',
      content: <NameStep value={createName} onChange={setCreateName} />,
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

      {/* Agent filter */}
      <div className="fade-up flex items-center gap-4 [animation-delay:60ms]">
        <FilterDropdown
          label="Agent"
          value={agentFilter}
          options={agentFilterOptions}
          onChange={setAgentFilter}
          active={!!agentFilter}
          accent={agentFilter ? agentColor(agentFilter) : undefined}
          width={240}
        />
        <span className="text-body text-muted">
          {visibleSuites.length} suite{visibleSuites.length !== 1 ? 's' : ''}
        </span>
        <Button
          variant="primary"
          data-testid="suite-create-btn"
          className="ml-auto"
          onClick={() => { setCreateOpen(true); resetCreate(); }}
        >
          + New suite
        </Button>
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
      <div data-testid="suite-list" className="fade-up grid gap-[14px] [animation-delay:100ms] grid-cols-[repeat(auto-fill,minmax(380px,1fr))]">
        {visibleSuites.map(suite => (
          <SuiteCard
            key={suite.id}
            suite={suite}
            highlight={highlightSuiteId === suite.id}
            onRun={() => { setRunSuite(suite); setRunDone(false); }}
            onEdit={() => setEditSuite(suite)}
            onDelete={() => setDeleteSuite(suite)}
          />
        ))}
        {!isLoading && visibleSuites.length === 0 && (
          <div className="col-span-full" data-testid="suite-empty-state">
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
