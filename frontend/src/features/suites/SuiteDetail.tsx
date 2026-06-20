import { useMemo, useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import type { AgentCallDto, TestSuiteDto } from '../../api/models';
import { Card } from '../../components/ui/Card';
import { Tabs, type TabItem } from '../../components/ui/Tabs';
import { cn } from '../../lib/cn';
import { SkeletonList } from '../../components/ui/Skeleton';
import { useTestRunSchedules } from '../runs/hooks/useTestRunSchedules';
import { useSuiteDetail } from './hooks/useSuiteQueries';
import { useEditSuiteEvaluators, useEditSuiteTraces } from './hooks/useEditSuiteQueries';
import { useSuiteRunStats } from './hooks/useSuiteRunStats';
import { useSuiteEditor } from './hooks/useSuiteEditor';
import { useSaveSuite } from './hooks/useSaveSuite';
import { suiteWindowRange, type SuiteWindowKey } from './suiteWindow';
import { TestCasesPanel } from './components/TestCasesPanel';
import { AddTracesModal } from './components/AddTracesModal';
import { SuiteHistoryTab } from './components/SuiteHistoryTab';
import { TraceConversationPreview, PreviewEmpty } from './components/TestCasePreview';
import { EditableTestCasePreview } from './components/EditableTestCasePreview';
import { EvaluatorsPanel } from './components/EvaluatorsPanel';
import { EvaluatorPreview } from './components/EvaluatorPreview';
import { SuiteStatsStrip } from './components/SuiteStatsStrip';
import { SuiteDetailHeader } from './components/SuiteDetailHeader';
import { SuiteSchedulesSection } from './components/SuiteSchedulesSection';
import { SuiteSaveBar } from './components/SuiteSaveBar';

type Tab = 'cases' | 'evaluators' | 'history' | 'schedules';

/** List + preview split for the case/evaluator tabs. Always two columns (the suite list/preview are
 * narrow and compress via `minmax(0,1fr)`), so the pane never stacks inside the fixed-height,
 * clipped workspace — only the internal-scroll height is gated to `md:` (below it the page scrolls). */
const SPLIT = cn('grid gap-3 p-5 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:h-full md:min-h-0');
const PREVIEW = cn('rounded-[12px] border border-border bg-card overflow-hidden min-h-0');

interface Props { suiteId: string; projectId?: string; onRun: () => void; onDelete: () => void; }

export function SuiteDetail({ suiteId, projectId, onRun, onDelete }: Props) {
  const { suite, isLoading } = useSuiteDetail(suiteId);
  if (isLoading || !suite) {
    return <Card className="md:h-full"><SkeletonList rows={6} height={44} gap={10} /></Card>;
  }
  // Re-key on updatedAt so a post-save (or external) refetch remounts the editor with a fresh
  // baseline — otherwise the staged add/remove/evaluator buffers would desync from the new suite
  // and show phantom unsaved changes.
  return <SuiteDetailInner key={`${suite.id}:${suite.updatedAt}`} suite={suite} projectId={projectId} onRun={onRun} onDelete={onDelete} />;
}

function SuiteDetailInner({ suite, projectId, onRun, onDelete }: { suite: TestSuiteDto; projectId?: string; onRun: () => void; onDelete: () => void }) {
  const { t } = useLingui();
  const editor = useSuiteEditor(suite);
  // eslint-disable-next-line lingui/no-unlocalized-strings -- Tab enum token, not UI copy
  const [tab, setTab] = useState<Tab>('cases');
  // eslint-disable-next-line lingui/no-unlocalized-strings -- SuiteWindowKey enum token, not UI copy
  const [windowKey, setWindowKey] = useState<SuiteWindowKey>('all');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(suite.testCases[0]?.id ?? null);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [selectedEvalId, setSelectedEvalId] = useState<string | null>(suite.evaluators[0]?.id ?? null);
  const [addOpen, setAddOpen] = useState(false);
  // Trace payloads chosen in the add modal, cached here so staged-add rows + the preview resolve
  // even though the picker reads a different (success-only, paged) query than `traces` below.
  const [addedTraceObjs, setAddedTraceObjs] = useState<Map<string, AgentCallDto>>(new Map());

  const statsWindow = useMemo(() => suiteWindowRange(windowKey, suite.lastRunAt), [windowKey, suite.lastRunAt]);
  const { stats, isLoading: statsLoading } = useSuiteRunStats(suite.id, statsWindow);

  const { evaluators } = useEditSuiteEvaluators(projectId);
  const { traces } = useEditSuiteTraces(suite.agentId);
  // Same cached query SuiteSchedulesSection reads — used here only to badge the Schedules tab.
  const { schedules } = useTestRunSchedules(suite.agentId);
  const scheduleCount = useMemo(() => schedules.filter(s => s.suiteId === suite.id).length, [schedules, suite.id]);

  const traceById = useMemo(() => {
    const m = new Map(traces.map(t => [t.id, t]));
    addedTraceObjs.forEach((t, id) => m.set(id, t));
    return m;
  }, [traces, addedTraceObjs]);
  const agentTools = useMemo(() => [...new Map(traces.flatMap(t => t.tools).map(t => [t.name, t])).values()], [traces]);
  const evalById = useMemo(() => new Map(evaluators.map(e => [e.id, e])), [evaluators]);

  const save = useSaveSuite(() => editor.reset());

  const pendingAddTraces: AgentCallDto[] = editor.resolveAddTraces(traceById);
  const focusedCase = suite.testCases.find(tc => tc.id === selectedCaseId) ?? null;
  const focusedTrace = selectedTraceId ? (traceById.get(selectedTraceId) ?? null) : null;
  const focusedEval = selectedEvalId ? (evalById.get(selectedEvalId) ?? null) : null;

  function selectCase(id: string) { setSelectedCaseId(id); setSelectedTraceId(null); }
  function selectTrace(id: string) { setSelectedTraceId(id); setSelectedCaseId(null); }

  function addTraces(picked: AgentCallDto[]) {
    if (picked.length === 0) return;
    setAddedTraceObjs(prev => {
      const next = new Map(prev);
      picked.forEach(t => next.set(t.id, t));
      return next;
    });
    picked.forEach(t => { if (!editor.pendingAddTraceIds.has(t.id)) editor.toggleAddTrace(t.id); });
    selectTrace(picked[picked.length - 1].id);
  }

  function discard() { editor.reset(); setAddedTraceObjs(new Map()); }

  /* eslint-disable lingui/no-unlocalized-strings -- Tab value + data-testid tokens, not UI copy */
  const tabItems: TabItem[] = [
    { value: 'cases', label: t`Test Cases`, count: suite.testCases.length, 'data-testid': 'suite-tab-cases' },
    { value: 'evaluators', label: t`Evaluators`, count: suite.evaluators.length, 'data-testid': 'suite-tab-evaluators' },
    { value: 'history', label: t`History`, count: suite.totalRuns || undefined, 'data-testid': 'suite-tab-history' },
    { value: 'schedules', label: t`Schedules`, count: scheduleCount || undefined, 'data-testid': 'suite-tab-schedules' },
  ];
  /* eslint-enable lingui/no-unlocalized-strings */

  return (
    <div
      data-testid="suite-detail"
      className="flex flex-col min-w-0 min-h-0 md:h-full overflow-hidden rounded-xl bg-surface-2 shadow-[var(--shadow-card)]"
    >
      <SuiteDetailHeader suite={suite} onRun={onRun} onDelete={onDelete} />

      <SuiteStatsStrip stats={stats} isLoading={statsLoading} windowKey={windowKey} onWindowChange={setWindowKey} />

      <div className="shrink-0 px-5 pt-2">
        <Tabs value={tab} onChange={v => setTab(v as Tab)} items={tabItems} />
      </div>

      <div className="flex-1 min-h-0 md:overflow-hidden">
        {tab === 'cases' && (
          <div className={SPLIT}>
            <TestCasesPanel
              cases={suite.testCases}
              pendingAddTraces={pendingAddTraces}
              pendingRemoveCaseIds={editor.pendingRemoveCaseIds}
              selectedCaseId={selectedCaseId}
              selectedTraceId={selectedTraceId}
              onSelectCase={selectCase}
              onSelectTrace={selectTrace}
              onToggleRemove={editor.toggleRemoveCase}
              onUnstageAdd={editor.toggleAddTrace}
              onOpenAdd={() => setAddOpen(true)}
            />
            <div className={PREVIEW}>
              {focusedTrace
                ? <TraceConversationPreview trace={focusedTrace} />
                : focusedCase
                  ? <EditableTestCasePreview key={focusedCase.id} testCase={focusedCase} tools={agentTools} />
                  : <PreviewEmpty title={t`Select a case or trace`} description={t`Click any row to inspect its conversation.`} />}
            </div>
          </div>
        )}

        {tab === 'evaluators' && (
          <div className={SPLIT}>
            <EvaluatorsPanel
              evaluators={evaluators}
              baselineIds={editor.baselineEvaluatorIds}
              stagedIds={editor.stagedEvaluatorIds}
              selectedId={selectedEvalId}
              onSelect={setSelectedEvalId}
              onToggle={editor.toggleEvaluator}
            />
            <div className={PREVIEW}>
              <EvaluatorPreview evaluator={focusedEval} attached={focusedEval ? editor.stagedEvaluatorIds.has(focusedEval.id) : false} />
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div className="h-full min-h-0 overflow-y-auto p-5">
            <SuiteHistoryTab suiteId={suite.id} />
          </div>
        )}

        {tab === 'schedules' && (
          <div className="h-full min-h-0 overflow-y-auto p-5">
            <SuiteSchedulesSection suiteId={suite.id} suiteName={suite.name} agentId={suite.agentId} />
          </div>
        )}
      </div>

      <SuiteSaveBar
        count={editor.isDirty ? editor.dirtyCount : 0}
        saving={save.isPending}
        onDiscard={discard}
        onSave={() => save.mutate({
          suiteId: suite.id,
          pendingAddTraceIds: editor.pendingAddTraceIds,
          pendingRemoveCaseIds: editor.pendingRemoveCaseIds,
          stagedEvaluatorIds: editor.stagedEvaluatorIds,
          evaluatorsChanged: editor.evaluatorsChanged,
        })}
      />

      {addOpen && (
        <AddTracesModal
          agentId={suite.agentId}
          onClose={() => setAddOpen(false)}
          onAdd={addTraces}
        />
      )}
    </div>
  );
}
