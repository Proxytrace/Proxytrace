import { useMemo, useState } from 'react';
import type { AgentCallDto, EvaluatorDetailDto, TestSuiteDto } from '../../api/models';
import { agentColor } from '../../lib/colors';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FilterTabs } from '../../components/ui/FilterTabs';
import { SkeletonList } from '../../components/ui/Skeleton';
import { PlayFilledIcon, TrashIcon } from '../../components/icons';
import { useSuiteDetail } from './hooks/useSuiteQueries';
import { useEditSuiteEvaluators, useEditSuiteTraces } from './hooks/useEditSuiteQueries';
import { useSuiteRunStats } from './hooks/useSuiteRunStats';
import { useSuiteEditor } from './hooks/useSuiteEditor';
import { useSaveSuite } from './hooks/useSaveSuite';
import { suiteWindowRange, type SuiteWindowKey } from './suiteWindow';
import { TestCasesPanel } from './components/TestCasesPanel';
import { TraceConversationPreview, PreviewEmpty } from './components/TestCasePreview';
import { EditableTestCasePreview } from './components/EditableTestCasePreview';
import { EvaluatorsPanel } from './components/EvaluatorsPanel';
import { EvaluatorPreview } from './components/EvaluatorPreview';
import { SuiteStatsStrip } from './components/SuiteStatsStrip';
import { SuiteSchedulesSection } from './components/SuiteSchedulesSection';

type Tab = 'cases' | 'evaluators';

interface Props { suiteId: string; projectId?: string; onRun: () => void; onDelete: () => void; }

export function SuiteDetail({ suiteId, projectId, onRun, onDelete }: Props) {
  const { suite, isLoading } = useSuiteDetail(suiteId);
  if (isLoading || !suite) {
    return <Card><SkeletonList rows={6} height={44} gap={10} /></Card>;
  }
  return <SuiteDetailInner key={suite.id} suite={suite} projectId={projectId} onRun={onRun} onDelete={onDelete} />;
}

function SuiteDetailInner({ suite, projectId, onRun, onDelete }: { suite: TestSuiteDto; projectId?: string; onRun: () => void; onDelete: () => void }) {
  const editor = useSuiteEditor(suite);
  const [tab, setTab] = useState<Tab>('cases');
  const [windowKey, setWindowKey] = useState<SuiteWindowKey>('all');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(suite.testCases[0]?.id ?? null);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [selectedEvalId, setSelectedEvalId] = useState<string | null>(suite.evaluators[0]?.id ?? null);

  const window = useMemo(() => suiteWindowRange(windowKey, suite.lastRunAt), [windowKey, suite.lastRunAt]);
  const { stats, isLoading: statsLoading } = useSuiteRunStats(suite.id, window);

  const { evaluators } = useEditSuiteEvaluators(projectId);
  const { traces } = useEditSuiteTraces(suite.agentId);
  const traceById = useMemo(() => new Map(traces.map(t => [t.id, t])), [traces]);
  const agentTools = useMemo(() => [...new Map(traces.flatMap(t => t.tools).map(t => [t.name, t])).values()], [traces]);
  const evalById = useMemo(() => new Map(evaluators.map(e => [e.id, e])), [evaluators]);

  const save = useSaveSuite(() => editor.reset());
  const c = agentColor(suite.agentId);

  const pendingAddTraces: AgentCallDto[] = editor.resolveAddTraces(traceById);
  const focusedCase = suite.testCases.find(tc => tc.id === selectedCaseId) ?? null;
  const focusedTrace = selectedTraceId ? (traceById.get(selectedTraceId) ?? null) : null;
  const focusedEval = selectedEvalId ? (evalById.get(selectedEvalId) ?? null) : null;

  function selectCase(id: string) { setSelectedCaseId(id); setSelectedTraceId(null); }
  function selectTrace(id: string) { setSelectedTraceId(id); setSelectedCaseId(null); }
  function addTrace(id: string) { editor.toggleAddTrace(id); selectTrace(id); }

  return (
    <div className="flex flex-col gap-3 min-h-0" data-testid="suite-detail">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-h2 font-bold truncate" data-testid="suite-detail-name">{suite.name}</h2>
          <span
            className="inline-flex mt-1 px-2 py-[2px] rounded-full text-[10.5px] font-semibold"
            style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}
          >
            {suite.agentName}
          </span>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button variant="primary" size="sm" leftIcon={<PlayFilledIcon size={11} />} onClick={onRun} data-testid="suite-run-btn">
            {suite.totalRuns > 0 ? 'Run again' : 'Run now'}
          </Button>
          <Button variant="dangerOutline" size="sm" onClick={onDelete} leftIcon={<TrashIcon size={13} />} data-testid="suite-detail-delete-btn">
            Delete
          </Button>
        </div>
      </div>

      <SuiteStatsStrip stats={stats} isLoading={statsLoading} windowKey={windowKey} onWindowChange={setWindowKey} />

      <div className="flex items-center justify-between gap-3">
        <FilterTabs
          options={[
            { label: 'Test Cases', value: 'cases', count: suite.testCases.length },
            { label: 'Evaluators', value: 'evaluators', count: evaluators.length },
          ]}
          value={tab}
          onChange={v => setTab(v as Tab)}
        />
        {editor.isDirty && (
          <span className="text-body-sm text-warn font-semibold" data-testid="suite-dirty-count">{editor.dirtyCount} unsaved</span>
        )}
      </div>

      <div className="grid gap-3 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] h-[46vh]">
        {tab === 'cases' ? (
          <>
            <TestCasesPanel
              agentId={suite.agentId}
              cases={suite.testCases}
              pendingAddTraces={pendingAddTraces}
              pendingRemoveCaseIds={editor.pendingRemoveCaseIds}
              pendingAddTraceIds={editor.pendingAddTraceIds}
              selectedCaseId={selectedCaseId}
              selectedTraceId={selectedTraceId}
              onSelectCase={selectCase}
              onSelectTrace={selectTrace}
              onToggleRemove={editor.toggleRemoveCase}
              onToggleAddTrace={addTrace}
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
              baselineIds={editor.baselineEvaluatorIds}
              stagedIds={editor.stagedEvaluatorIds}
              selectedId={selectedEvalId}
              onSelect={setSelectedEvalId}
              onToggle={editor.toggleEvaluator}
            />
            <div className="rounded-[12px] border border-border bg-card overflow-hidden min-h-0">
              <EvaluatorPreview evaluator={focusedEval} attached={focusedEval ? editor.stagedEvaluatorIds.has(focusedEval.id) : false} />
            </div>
          </>
        )}
      </div>

      {editor.isDirty && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={editor.reset} data-testid="suite-discard-btn">Discard</Button>
          <Button
            variant="primary"
            size="sm"
            loading={save.isPending}
            data-testid="edit-suite-save-btn"
            onClick={() => save.mutate({
              suiteId: suite.id,
              pendingAddTraceIds: editor.pendingAddTraceIds,
              pendingRemoveCaseIds: editor.pendingRemoveCaseIds,
              stagedEvaluatorIds: editor.stagedEvaluatorIds,
              evaluatorsChanged: editor.evaluatorsChanged,
            })}
          >
            Save changes
          </Button>
        </div>
      )}

      <SuiteSchedulesSection suiteId={suite.id} suiteName={suite.name} agentId={suite.agentId} />
    </div>
  );
}
