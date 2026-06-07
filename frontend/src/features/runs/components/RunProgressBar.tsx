import type { TestRunDto } from '../../../api/models';
import { runGroupProgress } from '../results';
import { fmtDuration } from '../../../lib/format';
import { ProgressBar } from '../../../components/ui/ProgressBar';

/**
 * Live run progress for an active group: a determinate bar plus "done/total · percent · ~ETA".
 * Counts are monotonic (results only upsert), so the bar never jumps backwards.
 */
export function RunProgressBar({ runs }: { runs: TestRunDto[] }) {
  const { done, total, percent, etaMs } = runGroupProgress(runs);
  return (
    <div className="flex items-center gap-2.5 min-w-0" data-testid="run-progress-bar">
      <div className="flex-1 min-w-[120px] max-w-[280px]">
        <ProgressBar value={percent} />
      </div>
      <span className="mono text-caption text-muted shrink-0">{done}/{total} · {percent}%</span>
      {etaMs !== null && (
        <span className="mono text-caption text-muted shrink-0">~{fmtDuration(etaMs)} left</span>
      )}
    </div>
  );
}
