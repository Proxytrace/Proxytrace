import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AgentCallDto, EvaluatorDetailDto, TestSuiteDto } from '../../../api/models';
import { testSuitesApi } from '../../../api/test-suites';
import { evaluatorsApi } from '../../../api/evaluators';
import { agentCallsApi } from '../../../api/agent-calls';
import { QUERY_KEYS } from '../../../api/query-keys';
import { FilterTabs } from '../../../components/ui/FilterTabs';
import { useToast } from '../../../components/ui/Toast';
import { XIcon } from '../../../components/icons';
import { agentColor } from '../../../lib/colors';
import { TestCasesPanel } from './TestCasesPanel';
import { TestCasePreview, TraceConversationPreview, PreviewEmpty } from './TestCasePreview';
import { EvaluatorsPanel } from './EvaluatorsPanel';
import { EvaluatorPreview } from './EvaluatorPreview';

interface Props {
  suite: TestSuiteDto;
  projectId?: string;
  onClose: () => void;
}

type Tab = 'cases' | 'evaluators';

export function EditSuiteDialog({ suite, projectId, onClose }: Props) {
  const qc = useQueryClient();
  const { show: toast } = useToast();

  const [tab, setTab] = useState<Tab>('cases');
  const [pendingAddTraceIds, setPendingAddTraceIds] = useState<Set<string>>(new Set());
  const [pendingRemoveCaseIds, setPendingRemoveCaseIds] = useState<Set<string>>(new Set());
  const baselineEvaluatorIds = useMemo(() => new Set(suite.evaluators.map(e => e.id)), [suite]);
  const [stagedEvaluatorIds, setStagedEvaluatorIds] = useState<Set<string>>(new Set(baselineEvaluatorIds));
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(suite.testCases[0]?.id ?? null);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [selectedEvalId, setSelectedEvalId] = useState<string | null>(suite.evaluators[0]?.id ?? null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const { data: evaluators = [] } = useQuery({
    queryKey: QUERY_KEYS.evaluators(projectId),
    queryFn: () => evaluatorsApi.list({ projectId }),
  });
  const { data: tracesData } = useQuery({
    queryKey: QUERY_KEYS.agentCallsForSuiteEdit(suite.agentId),
    queryFn: () => agentCallsApi.list({ agentId: suite.agentId, pageSize: 50 }),
  });
  const traces = tracesData?.items ?? [];

  const traceById = useMemo(() => new Map(traces.map(t => [t.id, t])), [traces]);
  const evalById = useMemo(() => new Map((evaluators as EvaluatorDetailDto[]).map(e => [e.id, e])), [evaluators]);
  const pendingAddTraces: AgentCallDto[] = Array.from(pendingAddTraceIds)
    .map(id => traceById.get(id))
    .filter((t): t is AgentCallDto => !!t);

  const evaluatorsChanged =
    stagedEvaluatorIds.size !== baselineEvaluatorIds.size ||
    [...stagedEvaluatorIds].some(id => !baselineEvaluatorIds.has(id));

  const dirtyCount = pendingAddTraceIds.size + pendingRemoveCaseIds.size + (evaluatorsChanged ? 1 : 0);
  const isDirty = dirtyCount > 0;

  const save = useMutation({
    mutationFn: async () => {
      for (const traceId of pendingAddTraceIds) {
        await testSuitesApi.addTestCase(suite.id, traceId);
      }
      for (const caseId of pendingRemoveCaseIds) {
        await testSuitesApi.removeTestCase(suite.id, caseId);
      }
      if (evaluatorsChanged) {
        await testSuitesApi.updateEvaluators(suite.id, [...stagedEvaluatorIds]);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['test-suites'] });
      onClose();
    },
    onError: (err) => toast((err as Error).message || 'Failed to save changes', 'error'),
  });

  function attemptClose() {
    if (isDirty) setConfirmDiscard(true);
    else onClose();
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmDiscard) setConfirmDiscard(false);
        else attemptClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, confirmDiscard]);

  function toggleAddTrace(id: string) {
    setPendingAddTraceIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
    setSelectedTraceId(id);
    setSelectedCaseId(null);
  }
  function selectCase(id: string) {
    setSelectedCaseId(id);
    setSelectedTraceId(null);
  }
  function selectTrace(id: string) {
    setSelectedTraceId(id);
    setSelectedCaseId(null);
  }
  function toggleRemoveCase(id: string) {
    setPendingRemoveCaseIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }
  function toggleEvaluator(id: string) {
    setStagedEvaluatorIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  const c = agentColor(suite.agentId);
  const focusedCase = suite.testCases.find(tc => tc.id === selectedCaseId) ?? null;
  const focusedTrace = selectedTraceId ? traceById.get(selectedTraceId) ?? null : null;
  const focusedEval = selectedEvalId ? evalById.get(selectedEvalId) ?? null : null;

  return createPortal(
    <>
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && attemptClose()}>
        <div
          className="modal-panel fade-up flex flex-col"
          style={{ maxWidth: 'min(1180px, 94vw)', width: '100%', maxHeight: '92vh' }}
        >
          <Header suite={suite} agentColorHex={c} onClose={attemptClose} />

          <div className="mt-4 mb-4 flex items-center justify-between gap-3">
            <FilterTabs
              options={[
                { label: 'Test Cases', value: 'cases', count: suite.testCases.length },
                { label: 'Evaluators', value: 'evaluators', count: evaluators.length },
              ]}
              value={tab}
              onChange={(v) => setTab(v as Tab)}
            />
            <DirtyIndicator count={dirtyCount} />
          </div>

          <div
            className="flex-1 min-h-0 grid gap-4"
            style={{ gridTemplateColumns: 'minmax(0, 1fr) 540px', height: '60vh' }}
          >
            {tab === 'cases' ? (
              <>
                <TestCasesPanel
                  agentId={suite.agentId}
                  cases={suite.testCases}
                  pendingAddTraces={pendingAddTraces}
                  pendingRemoveCaseIds={pendingRemoveCaseIds}
                  pendingAddTraceIds={pendingAddTraceIds}
                  selectedCaseId={selectedCaseId}
                  selectedTraceId={selectedTraceId}
                  onSelectCase={selectCase}
                  onSelectTrace={selectTrace}
                  onToggleRemove={toggleRemoveCase}
                  onToggleAddTrace={toggleAddTrace}
                />
                <div className="rounded-[12px] border border-border bg-card overflow-hidden min-h-0">
                  {focusedTrace
                    ? <TraceConversationPreview trace={focusedTrace} />
                    : focusedCase
                      ? <TestCasePreview testCase={focusedCase} />
                      : <PreviewEmpty title="Select a case or trace" description="Click any row to inspect its conversation." />}
                </div>
              </>
            ) : (
              <>
                <EvaluatorsPanel
                  evaluators={evaluators as EvaluatorDetailDto[]}
                  baselineIds={baselineEvaluatorIds}
                  stagedIds={stagedEvaluatorIds}
                  selectedId={selectedEvalId}
                  onSelect={setSelectedEvalId}
                  onToggle={toggleEvaluator}
                />
                <div className="rounded-[12px] border border-border bg-card overflow-hidden min-h-0">
                  <EvaluatorPreview
                    evaluator={focusedEval}
                    attached={focusedEval ? stagedEvaluatorIds.has(focusedEval.id) : false}
                  />
                </div>
              </>
            )}
          </div>

          <Footer
            dirtyCount={dirtyCount}
            saving={save.isPending}
            onCancel={attemptClose}
            onSave={() => save.mutate()}
          />
        </div>
      </div>

      {confirmDiscard && (
        <DiscardConfirm
          count={dirtyCount}
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => { setConfirmDiscard(false); onClose(); }}
        />
      )}
    </>,
    document.body,
  );
}

function Header({ suite, agentColorHex, onClose }: { suite: TestSuiteDto; agentColorHex: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <div
          className="w-10 h-10 rounded-[10px] shrink-0 flex items-center justify-center"
          style={{ background: `${agentColorHex}1f`, border: `1px solid ${agentColorHex}33` }}
        >
          <span className="text-[14px] font-bold" style={{ color: agentColorHex }}>
            {suite.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <h2 className="m-0 text-base font-bold text-primary truncate">{suite.name}</h2>
          <div className="mt-[3px] flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-[5px] px-2 py-[2px] rounded-full text-[10.5px] font-semibold"
              style={{ background: `${agentColorHex}20`, color: agentColorHex, boxShadow: 'var(--shadow-pill)' }}
            >
              {suite.agentName}
            </span>
            <span className="text-[11.5px] text-muted">
              {suite.testCases.length} cases · {suite.evaluators.length} evaluators · {suite.totalRuns} runs
            </span>
            {suite.passRate !== null && (
              <span className="text-[11.5px] text-muted">· {Math.round(suite.passRate)}% pass</span>
            )}
          </div>
          {suite.description && (
            <p className="mt-2 text-[12.5px] text-secondary leading-[1.55] m-0 line-clamp-2">{suite.description}</p>
          )}
        </div>
      </div>
      <button onClick={onClose} className="btn-icon shrink-0"><XIcon size={14} /></button>
    </div>
  );
}

function DirtyIndicator({ count }: { count: number }) {
  if (count === 0) {
    return <span className="text-[11.5px] text-muted">No changes</span>;
  }
  return (
    <span
      className="inline-flex items-center gap-[5px] px-[10px] py-[3px] rounded-full text-[11.5px] font-semibold"
      style={{ background: 'var(--accent-subtle)', color: 'var(--accent-hover)', border: '1px solid var(--accent-primary)' }}
    >
      <span className="w-[6px] h-[6px] rounded-full" style={{ background: 'var(--accent-primary)' }} />
      {count} unsaved {count === 1 ? 'change' : 'changes'}
    </span>
  );
}

function Footer({ dirtyCount, saving, onCancel, onSave }: { dirtyCount: number; saving: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <div className="mt-5 flex items-center justify-between gap-3 pt-4 border-t border-hairline">
      <span className="text-[11.5px] text-muted">
        {dirtyCount === 0 ? 'Up to date' : `Save will apply ${dirtyCount} change${dirtyCount === 1 ? '' : 's'}.`}
      </span>
      <div className="flex items-center gap-2">
        <button className="btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        <button
          className="btn-primary"
          onClick={onSave}
          disabled={dirtyCount === 0 || saving}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

function DiscardConfirm({ count, onCancel, onConfirm }: { count: number; onCancel: () => void; onConfirm: () => void }) {
  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 100 }} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal-panel fade-up" style={{ maxWidth: 'min(440px, 94vw)', width: '100%' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="m-0 text-base font-bold text-primary">Discard changes?</h2>
          <button onClick={onCancel} className="btn-icon"><XIcon size={14} /></button>
        </div>
        <p className="text-[13px] text-secondary m-0">
          You have {count} unsaved {count === 1 ? 'change' : 'changes'}. Closing now will discard {count === 1 ? 'it' : 'them'}.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onCancel}>Keep editing</button>
          <button className="btn-danger" onClick={onConfirm}>Discard</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
