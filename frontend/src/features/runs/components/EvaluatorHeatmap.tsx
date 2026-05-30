import type { TestRunGroupDto } from '../../../api/models';
import { buildEvaluatorHeatmap, scoreBucketColor, SCORE_LEVELS } from '../comparison';
import { EVALUATOR_KIND_COLOR } from '../../../lib/colors';
import { Card } from '../../../components/ui/Card';
import { ModelTag } from './ModelTag';
import { DistributionBar } from './DistributionBar';

/** Score-distribution table: evaluators (rows) × models (columns). */
export function EvaluatorHeatmap({ group }: { group: TestRunGroupDto }) {
  const rows = buildEvaluatorHeatmap(group);
  const runs = group.runs;
  const hasJudgements = rows.some(r => r.cells.some(c => c.total > 0));
  if (rows.length === 0 || !hasJudgements) return null;

  const gridCols = `minmax(160px,1.4fr) repeat(${runs.length}, minmax(120px,1fr))`;

  return (
    <Card padding="none" data-testid="evaluator-heatmap">
      <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-2.5 border-b border-hairline">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <span className="text-h2 font-semibold">Evaluator breakdown</span>
          <span className="text-body-sm text-muted">Score distribution per evaluator, per model</span>
        </div>
        <ScoreRamp />
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-max" style={{ gridTemplateColumns: gridCols }}>
          {/* Header */}
          <div className="px-3 py-2 border-b border-hairline text-caption font-semibold text-muted uppercase tracking-[0.06em] flex items-center">Evaluator</div>
          {runs.map(run => (
            <div key={run.id} className="px-3 py-2 border-b border-hairline flex items-center">
              <ModelTag name={run.endpointName} size="xs" />
            </div>
          ))}

          {/* Rows */}
          {rows.map((row, i) => (
            <Row key={row.evaluator.id} divider={i > 0}>
              <div className="px-3 py-2 min-w-0 flex items-center gap-2 text-body-sm font-semibold">
                <span className="w-[7px] h-[7px] rounded-sm shrink-0" style={{ background: EVALUATOR_KIND_COLOR[row.evaluator.kind] }} />
                <span className="truncate">{row.evaluator.name}</span>
              </div>
              {row.cells.map(cell => (
                <div
                  key={cell.run.id}
                  data-testid={`evaluator-heatmap-cell-${row.evaluator.id}-${cell.run.id}`}
                  className="px-3 py-2 flex flex-col justify-center"
                >
                  <DistributionBar cell={cell} />
                </div>
              ))}
            </Row>
          ))}
        </div>
      </div>
    </Card>
  );
}

/** `display:contents` wrapper so each evaluator's cells share one grid row + top divider. */
function Row({ divider, children }: { divider: boolean; children: React.ReactNode }) {
  return <div className={`contents ${divider ? '[&>*]:border-t [&>*]:border-hairline' : ''}`}>{children}</div>;
}

function ScoreRamp() {
  return (
    <div className="flex items-center gap-2 text-caption text-muted">
      <span className="text-success">pass</span>
      <div className="flex h-2 w-24 rounded-full overflow-hidden">
        {SCORE_LEVELS.map(level => (
          <span key={level} title={level} className="flex-1" style={{ background: scoreBucketColor(level) }} />
        ))}
      </div>
      <span className="text-danger">fail</span>
    </div>
  );
}
