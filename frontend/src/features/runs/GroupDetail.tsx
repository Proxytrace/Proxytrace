import type { TestRunGroupDto } from '../../api/models';
import { isActive } from './results';
import { useCancelTestRunGroup } from './hooks/useCancelTestRunGroup';
import { useRunGroupStream } from './hooks/useRunGroupStream';
import { RunGroupHeader } from './components/RunGroupHeader';
import { PerformanceSummary } from './components/PerformanceSummary';
import { EvaluatorHeatmap } from './components/EvaluatorHeatmap';
import { MatrixView } from './MatrixView';

export function GroupDetail({ group, onDelete }: { group: TestRunGroupDto; onDelete: () => void }) {
  const active = group.runs.some(r => isActive(r.status));

  // Live updates flow through SSE only: the stream hook patches the cached group list in place
  // and surfaces per-evaluator in-flight progress — no polling, no refetch until the run ends.
  const live = useRunGroupStream(group.id, active);
  const cancelGroup = useCancelTestRunGroup(group.id);

  const multipleRuns = group.runs.length > 1;

  // Single- and multi-endpoint groups render identically: the matrix is the canonical results
  // view (one column per endpoint) and the only scroller, so this column fills the viewport and
  // never spills a page scrollbar.
  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <RunGroupHeader
        group={group}
        onDelete={onDelete}
        onCancel={() => cancelGroup.mutate()}
        cancelPending={cancelGroup.isPending}
      />

      {multipleRuns && <PerformanceSummary runs={group.runs} />}

      <EvaluatorHeatmap group={group} live={live} />

      <MatrixView group={group} live={live} />
    </div>
  );
}
