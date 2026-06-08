import type { TestRunDto } from '../../../api/models';
import { buildLeaderboard } from '../comparison';
import { runsComplete } from '../results';
import { ModelSummaryCard } from './ModelSummaryCard';

/**
 * Per-model performance summary shown above the matrix for every run group — a grid of one
 * card per model (a single-model group is just the N-of-1 case). Winner badges and comparative
 * coloring only appear once the whole group has settled (see {@link buildLeaderboard}).
 */
export function PerformanceSummary({ runs }: { runs: TestRunDto[] }) {
  const complete = runsComplete(runs);
  const entries = buildLeaderboard(runs, complete);
  const multi = runs.length > 1;
  if (entries.length === 0) return null;

  return (
    <div data-testid="model-leaderboard" className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
      {entries.map(entry => (
        <div key={entry.run.id} data-testid={`model-leaderboard-entry-${entry.run.endpointId}`}>
          <ModelSummaryCard entry={entry} multi={multi} />
        </div>
      ))}
    </div>
  );
}
