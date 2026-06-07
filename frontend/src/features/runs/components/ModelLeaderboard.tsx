import type { TestRunDto } from '../../../api/models';
import { buildLeaderboard } from '../comparison';
import { runsComplete } from '../results';
import { ModelSummaryCard } from './ModelSummaryCard';

/** Per-model comparison cards shown above the matrix for a multi-model run group. */
export function ModelLeaderboard({ runs }: { runs: TestRunDto[] }) {
  const entries = buildLeaderboard(runs, runsComplete(runs));
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
