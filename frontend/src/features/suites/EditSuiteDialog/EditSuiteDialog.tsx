import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AgentCallDto, EvaluatorDetailDto, TestSuiteDto } from '../../../api/models';
import { FilterTabs } from '../../../components/ui/FilterTabs';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { agentColor } from '../../../lib/colors';
import { TestCasesPanel } from '../components/TestCasesPanel';
import { TraceConversationPreview, PreviewEmpty } from '../components/TestCasePreview';
import { EditableTestCasePreview } from '../components/EditableTestCasePreview';
import { EvaluatorsPanel } from '../components/EvaluatorsPanel';
import { EvaluatorPreview } from '../components/EvaluatorPreview';
import { useEditSuiteEvaluators, useEditSuiteTraces } from '../hooks/useEditSuiteQueries';
import { useSuiteDetail } from '../hooks/useSuiteQueries';
import { useSaveSuite } from '../hooks/useSaveSuite';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { EditSuiteHeader } from './components/EditSuiteHeader';
import { EditSuiteFooter } from './components/EditSuiteFooter';
import { DirtyIndicator } from './components/DirtyIndicator';
import { DiscardConfirm } from './components/DiscardConfirm';

interface Props {
  suiteId: string;
  projectId?: string;
  onClose: () => void;
}

type Tab = 'cases' | 'evaluators';

/**
 * Fetches the full (fat) suite — the list rows are light and carry no test cases — then renders the
 * editor once loaded. The inner component owns all the editing state, so it must only mount with the
 * complete suite in hand (hooks can't be gated behind an early return).
 */
export function EditSuiteDialog({ suiteId, projectId, onClose }: Props) {
  const { suite } = useSuiteDetail(suiteId);

  if (!suite) {
    return createPortal(
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal-panel fade-up flex flex-col" style={{ width: '100%', maxWidth: 'min(1180px, 94vw)', maxHeight: '92vh' }}>
          <SkeletonList rows={6} height={48} gap={10} />
        </div>
      </div>,
      document.body,
    );
  }

  return <EditSuiteDialogInner suite={suite} projectId={projectId} onClose={onClose} />;
}

function EditSuiteDialogInner({ suite, projectId, onClose }: { suite: TestSuiteDto; projectId?: string; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('cases');
  const [pendingAddTraceIds, setPendingAddTraceIds] = useState<Set<string>>(new Set());
  const [pendingRemoveCaseIds, setPendingRemoveCaseIds] = useState<Set<string>>(new Set());
  const baselineEvaluatorIds = useMemo(() => new Set(suite.evaluators.map(e => e.id)), [suite]);
  const [stagedEvaluatorIds, setStagedEvaluatorIds] = useState<Set<string>>(new Set(baselineEvaluatorIds));
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(suite.testCases[0]?.id ?? null);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [selectedEvalId, setSelectedEvalId] = useState<string | null>(suite.evaluators[0]?.id ?? null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const { evaluators } = useEditSuiteEvaluators(projectId);
  const { traces } = useEditSuiteTraces(suite.agentId);

  const traceById = useMemo(() => new Map(traces.map(t => [t.id, t])), [traces]);
  const agentTools = useMemo(() => {
    const byName = new Map(traces.flatMap(t => t.tools).map(tool => [tool.name, tool]));
    return [...byName.values()];
  }, [traces]);
  const evalById = useMemo(() => new Map(evaluators.map(e => [e.id, e])), [evaluators]);

  const pendingAddTraces: AgentCallDto[] = Array.from(pendingAddTraceIds)
    .map(id => traceById.get(id))
    .filter((t): t is AgentCallDto => t !== undefined);

  const evaluatorsChanged =
    stagedEvaluatorIds.size !== baselineEvaluatorIds.size ||
    [...stagedEvaluatorIds].some(id => !baselineEvaluatorIds.has(id));

  const dirtyCount = pendingAddTraceIds.size + pendingRemoveCaseIds.size + (evaluatorsChanged ? 1 : 0);
  const isDirty = dirtyCount > 0;

  function attemptClose() {
    if (isDirty) setConfirmDiscard(true);
    else onClose();
  }

  const save = useSaveSuite(onClose);

  // Genuine external keyboard subscription — acceptable per §4.1
  useEscapeKey(() => {
    if (confirmDiscard) setConfirmDiscard(false);
    else attemptClose();
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

  function selectCase(id: string) { setSelectedCaseId(id); setSelectedTraceId(null); }
  function selectTrace(id: string) { setSelectedTraceId(id); setSelectedCaseId(null); }

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
  const focusedTrace = selectedTraceId ? (traceById.get(selectedTraceId) ?? null) : null;
  const focusedEval = selectedEvalId ? (evalById.get(selectedEvalId) ?? null) : null;

  return createPortal(
    <>
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && attemptClose()}>
        <div
          data-testid="edit-suite-dialog"
          className="modal-panel fade-up flex flex-col"
          style={{ width: '100%', maxWidth: 'min(1180px, 94vw)', maxHeight: '92vh' }}
        >
          <EditSuiteHeader suite={suite} agentColorHex={c} onClose={attemptClose} />

          <div className="mt-4 mb-4 flex items-center justify-between gap-3">
            <FilterTabs
              options={[
                { label: 'Test Cases', value: 'cases', count: suite.testCases.length },
                { label: 'Evaluators', value: 'evaluators', count: evaluators.length },
              ]}
              value={tab}
              onChange={v => setTab(v as Tab)}
            />
            <DirtyIndicator count={dirtyCount} />
          </div>

          <div className="grid gap-4 grid-cols-[minmax(0,1fr)_540px] grid-rows-[minmax(0,1fr)] h-[60vh]">
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
                      ? <EditableTestCasePreview key={focusedCase.id} testCase={focusedCase} tools={agentTools} />
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

          <EditSuiteFooter
            dirtyCount={dirtyCount}
            saving={save.isPending}
            onCancel={attemptClose}
            onSave={() => save.mutate({
              suiteId: suite.id,
              pendingAddTraceIds,
              pendingRemoveCaseIds,
              stagedEvaluatorIds,
              evaluatorsChanged,
            })}
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
