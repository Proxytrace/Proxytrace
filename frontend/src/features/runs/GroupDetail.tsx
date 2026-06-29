import { Trans } from '@lingui/react/macro';
import { isActive } from './results';
import { Card } from '../../components/ui/Card';
import { SkeletonList } from '../../components/ui/Skeleton';
import { useCancelTestRunGroup } from './hooks/useCancelTestRunGroup';
import { useRunGroupStream } from './hooks/useRunGroupStream';
import { useTestRunGroupDetail } from './hooks/useTestRunGroupDetail';
import { RunGroupHeader } from './components/RunGroupHeader';
import { PerformanceSummary } from './components/PerformanceSummary';
import { EvaluatorHeatmap } from './components/EvaluatorHeatmap';
import { MatrixView } from './MatrixView';

export function GroupDetail({ groupId, onDelete }: { groupId: string; onDelete: () => void }) {
  // The list carries only light summaries; the fat group (per-case results/evaluations the matrix
  // renders) is fetched here per selection. Live updates then flow through SSE only: the stream hook
  // patches this cached group in place and surfaces per-evaluator in-flight progress — no polling, no
  // refetch until the run ends.
  const { group, isLoading } = useTestRunGroupDetail(groupId);
  // Stay subscribed until the *group* settles, not until its runs do. Keying off the runs tore the
  // stream down on the last `run-complete` — which can land before the terminal `group-run-complete`,
  // so `handleDone` never ran and the header stuck on "Running" until a manual refresh.
  const active = group ? isActive(group.status) : false;
  const live = useRunGroupStream(groupId, active);
  const cancelGroup = useCancelTestRunGroup(groupId);

  if (!group) {
    return (
      <Card>
        {isLoading
          ? <SkeletonList rows={4} height={72} gap={12} />
          : <div className="py-15 text-center text-muted text-body"><Trans>Run not found.</Trans></div>}
      </Card>
    );
  }

  // Single- and multi-endpoint groups render identically: the matrix is the canonical results
  // view (one column per endpoint). This column renders at its natural height — the run header,
  // performance summary, evaluator heatmap, and the full matrix scroll together as a single unit
  // inside the right detail panel's scroller (Runs.tsx), so the matrix keeps its full height and is
  // never squeezed when a run has many evaluators.
  return (
    <div className="flex flex-col gap-3">
      <RunGroupHeader
        group={group}
        onDelete={onDelete}
        onCancel={() => cancelGroup.mutate()}
        cancelPending={cancelGroup.isPending}
      />

      <PerformanceSummary group={group} />

      <EvaluatorHeatmap group={group} live={live} />

      <MatrixView group={group} live={live} />
    </div>
  );
}
