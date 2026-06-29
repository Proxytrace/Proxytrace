import { Trans, useLingui } from '@lingui/react/macro';
import { cn } from '../../../lib/cn';
import { RowButton } from '../../../components/ui/RowButton';
import type { EvaluationScore, EvaluatorScoreBucketDto } from '../../../api/models';
import { type RangeKey } from '../../../lib/time-range';
import { type TypeCategory, fullScoreDistribution } from '../evaluatorMeta';
import { categoryColorVar } from '../categoryClasses';

interface Props {
  buckets: EvaluatorScoreBucketDto[];
  category: TypeCategory;
  totalRuns: number;
  range: RangeKey;
  selectedScore: EvaluationScore | null;
  onSelectScore: (score: EvaluationScore) => void;
}

/** Horizontal bar chart of evaluation scores. Each bar filters the recent-evaluations table. */
export function ScoreDistributionPanel({ buckets, category, totalRuns, range, selectedScore, onSelectScore }: Props) {
  const { i18n } = useLingui();
  const data = fullScoreDistribution(buckets);
  const total = data.reduce((a, b) => a + b.count, 0);
  const max = Math.max(...data.map(d => d.count), 1);
  const empty = total === 0;
  const barColor = categoryColorVar[category];

  return (
    <section className="bg-card rounded-lg shadow-[var(--shadow-card)]">
      <header className="flex items-center gap-2.5 px-4 py-3 border-b border-hairline">
        <span className="text-caption text-muted uppercase tracking-[0.09em] font-semibold"><Trans>Score distribution</Trans></span>
        <span className="text-body-sm text-muted"><Trans>{range} · {totalRuns.toLocaleString()} runs</Trans></span>
        {selectedScore && (
          <span className="ml-auto text-caption text-muted"><Trans>Click a score to filter · selected highlights below</Trans></span>
        )}
      </header>
      <div className="px-4.5 py-4">
        {empty ? (
          <div className="h-24 flex items-center justify-center text-muted text-body-sm border border-dashed border-border rounded-md">
            <Trans>No data in range</Trans>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {data.map((d, i) => {
              const pct = total > 0 ? (d.count / total) * 100 : 0;
              const w = Math.max(2, (d.count / max) * 100);
              const intensity = 0.45 + (i / Math.max(1, data.length - 1)) * 0.55;
              const isActive = selectedScore === d.score;
              return (
                <RowButton
                  key={d.score}
                  onClick={() => onSelectScore(d.score)}
                  aria-pressed={isActive}
                  data-testid={`evaluator-score-bucket-${d.score}`}
                  className={cn(
                    'grid grid-cols-[90px_1fr_52px] items-center gap-2.5 text-body-sm rounded-sm px-1.5 py-1.5 transition-colors',
                    isActive ? 'bg-card-2' : 'hover:bg-card-2',
                    selectedScore && !isActive && 'opacity-55',
                  )}
                >
                  <span className={cn('overflow-hidden text-ellipsis whitespace-nowrap text-left', isActive ? 'text-primary font-semibold' : 'text-secondary')}>{i18n._(d.label)}</span>
                  <div className="h-3 bg-white/[0.03] rounded-sm overflow-hidden">
                    <div
                      className="h-full rounded-sm transition-[width] duration-300 ease-[var(--ease-standard)]"
                      style={{ width: w + '%', background: barColor, opacity: intensity }}
                    />
                  </div>
                  <span className="font-mono text-muted text-right text-caption">{pct.toFixed(1)}%</span>
                </RowButton>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
