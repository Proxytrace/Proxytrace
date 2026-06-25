import type { CSSProperties } from 'react';
import type { TestRunGroupDto } from '../../../api/models';
import { buildLeaderboard, comparisonGrid } from '../comparison';
import { runsComplete } from '../results';
import { cn } from '../../../lib/cn';
import { useCurrentEndpointId } from '../hooks/useAgentEndpoint';
import { ChampionPanel } from './ChampionPanel';
import { CandidateDelta } from './CandidateDelta';
import { MedalsRow } from './MedalsRow';

/**
 * Per-model comparison shown above the matrix for every run group. One model is the **baseline**
 * (the in-production model if the group includes it, else the best performer) and renders as the
 * champion panel; the rest read as deltas against it, with award medals beneath. A single-model
 * group is just the champion on its own. Comparative conclusions (deltas, medals) appear only once
 * the whole group settles — see {@link buildLeaderboard}.
 */
export function PerformanceSummary({ group }: { group: TestRunGroupDto }) {
  const currentEndpointId = useCurrentEndpointId(group.agentId);
  const runs = group.runs;
  const complete = runsComplete(runs);
  const entries = buildLeaderboard(runs, complete, currentEndpointId);
  if (entries.length === 0) return null;

  const multi = entries.length > 1;
  const baseline = entries.find(e => e.isBaseline) ?? null;
  const baselineIsProduction = baseline?.isProduction ?? false;
  // Baseline leads the row (wider first column); candidates follow in run order.
  const ordered = baseline ? [baseline, ...entries.filter(e => e.run.id !== baseline.run.id)] : entries;
  // Side-by-side once the pane is wide enough for the card count; stacks below (container query).
  const { cols, breakpoint } = comparisonGrid(entries.length, baseline !== null);

  return (
    <div className="@container" data-testid="model-leaderboard">
      <div className={cn('grid gap-3 grid-cols-1', breakpoint)} style={{ '--cmp-cols': cols } as CSSProperties}>
        {ordered.map(entry => (
          <div key={entry.run.id} data-testid={`model-leaderboard-entry-${entry.run.endpointId}`}>
            {entry.isBaseline
              ? <ChampionPanel entry={entry} />
              : <CandidateDelta entry={entry} baselineIsProduction={baselineIsProduction} />}
          </div>
        ))}
      </div>
      {multi && complete && <MedalsRow entries={entries} />}
    </div>
  );
}
