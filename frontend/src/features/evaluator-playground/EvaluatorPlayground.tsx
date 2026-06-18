import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { useEvaluatorList } from './hooks/useEvaluatorList';
import { useRecentEvaluations } from './hooks/useRecentEvaluations';
import { usePlaygroundSession } from './hooks/usePlaygroundSession';
import { useStickyPlaygroundSelection } from './hooks/useStickyPlaygroundSelection';
import { SelectionRail } from './components/SelectionRail';
import { BenchPane } from './components/BenchPane';
import { VerdictColumn } from './components/VerdictColumn';

// First column shares the locked ListRail left bound (minmax(248px,320px)); the playground keeps
// its own 3-column page (rail · bench · verdict) — see DESIGN.md "List rail" exception.
const GRID = 'flex-1 min-h-0 grid grid-cols-[minmax(248px,320px)_minmax(0,1fr)_360px] gap-3';

/**
 * Evaluator Playground — "Guided Rail": pick a judge and one of its past
 * evaluations in the left rail, edit the candidate response in the center
 * bench, and re-score live with the verdict gauge + run history on the right.
 */
export default function EvaluatorPlayground() {
  const { evaluators, isLoading, projectId } = useEvaluatorList();
  const { evalId, caseId, selectEvaluator, selectCase } = useStickyPlaygroundSelection(projectId);

  // Validate the selected evaluator against loaded data; fall back to the first
  // (derived, not written — BEST_PRACTICES §4.2).
  const selectedEvaluator = evaluators.find(e => e.id === evalId) ?? evaluators[0] ?? null;
  const effectiveEvalId = selectedEvaluator?.id ?? '';

  const recent = useRecentEvaluations(effectiveEvalId);
  // Auto-select the first past evaluation when none is picked — derived, not
  // written, so the address bar stays clean until the user chooses.
  const defaultCaseId = recent.items[0]?.testCaseId ?? null;
  const session = usePlaygroundSession(effectiveEvalId, caseId ?? defaultCaseId);

  if (!projectId) {
    return (
      <Frame>
        <EmptyState title="No project" description="Pick a project to use the evaluator playground." />
      </Frame>
    );
  }
  if (isLoading) {
    return (
      <Frame>
        <div className={GRID}>
          <Skeleton height="100%" />
          <Skeleton height="100%" />
          <Skeleton height="100%" />
        </div>
      </Frame>
    );
  }
  if (evaluators.length === 0 || !selectedEvaluator) {
    return (
      <Frame>
        <EmptyState
          title="No evaluators yet"
          description="Create an evaluator first, then come back here to probe it against past test results."
        />
      </Frame>
    );
  }

  return (
    <Frame>
      <div className={GRID}>
        <SelectionRail
          evaluators={evaluators}
          selectedEvaluatorId={selectedEvaluator.id}
          onSelectEvaluator={selectEvaluator}
          recent={recent}
          selectedCaseId={session.effectiveCaseId}
          onSelectCase={selectCase}
        />
        <BenchPane session={session} evaluator={selectedEvaluator} />
        <VerdictColumn session={session} evaluator={selectedEvaluator} />
      </div>
    </Frame>
  );
}

/** Stable page frame so the route's data-testid is present in every state. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div data-testid="evaluator-playground" className="flex-1 min-h-0 flex flex-col">
      {children}
    </div>
  );
}
