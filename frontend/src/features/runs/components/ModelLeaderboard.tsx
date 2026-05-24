import type { TestRunDto } from '../../../api/models';
import { buildLeaderboard } from '../comparison';
import { ModelLeaderboardCard } from './ModelLeaderboardCard';

/** Per-model comparison cards shown above the matrix for a multi-model run group. */
export function ModelLeaderboard({ runs }: { runs: TestRunDto[] }) {
  const entries = buildLeaderboard(runs);
  const multi = runs.length > 1;
  if (entries.length === 0) return null;

  return (
    <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
      {entries.map(entry => (
        <ModelLeaderboardCard key={entry.run.id} entry={entry} multi={multi} />
      ))}
    </div>
  );
}
