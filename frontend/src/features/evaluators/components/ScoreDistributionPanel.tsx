import type { EvaluatorScoreBucketDto } from '../../../api/models';
import { type RangeKey } from '../../../lib/time-range';
import { type TypeCategory, fullScoreDistribution } from '../evaluatorMeta';
import { categoryColorVar } from '../categoryClasses';

interface Props {
  buckets: EvaluatorScoreBucketDto[];
  category: TypeCategory;
  totalRuns: number;
  range: RangeKey;
}

/** Horizontal bar chart of evaluation scores across the canonical 5-point scale. */
export function ScoreDistributionPanel({ buckets, category, totalRuns, range }: Props) {
  const data = fullScoreDistribution(buckets);
  const total = data.reduce((a, b) => a + b.count, 0);
  const max = Math.max(...data.map(d => d.count), 1);
  const empty = total === 0;
  const barColor = categoryColorVar[category];

  return (
    <section className="bg-card rounded-lg shadow-[var(--shadow-card)]">
      <header className="flex items-center gap-2.5 px-4 py-3 border-b border-hairline">
        <span className="text-[10px] text-muted uppercase tracking-[0.09em] font-semibold">Score distribution</span>
        <span className="text-[11px] text-muted">{range} · {totalRuns.toLocaleString()} runs</span>
      </header>
      <div className="px-[18px] py-4">
        {empty ? (
          <div className="h-24 flex items-center justify-center text-muted text-[11.5px] border border-dashed border-border rounded-md">
            No data in range
          </div>
        ) : (
          <div className="flex flex-col gap-[7px]">
            {data.map((d, i) => {
              const pct = total > 0 ? (d.count / total) * 100 : 0;
              const w = Math.max(2, (d.count / max) * 100);
              const intensity = 0.45 + (i / Math.max(1, data.length - 1)) * 0.55;
              return (
                <div key={d.score} className="grid grid-cols-[90px_1fr_52px] items-center gap-2.5 text-[11px]">
                  <span className="text-secondary overflow-hidden text-ellipsis whitespace-nowrap">{d.label}</span>
                  <div className="h-3 bg-[rgba(255,255,255,0.03)] rounded-[4px] overflow-hidden">
                    <div
                      className="h-full rounded-[4px] transition-[width] duration-300 ease-[var(--ease-standard)]"
                      style={{ width: w + '%', background: barColor, opacity: intensity }}
                    />
                  </div>
                  <span className="font-mono text-muted text-right text-[10.5px]">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
