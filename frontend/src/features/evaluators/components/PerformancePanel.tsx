import { Trans, useLingui } from '@lingui/react/macro';
import { fmtPct, fmtLatency } from '../../../lib/format';
import { AreaChart } from '../../../components/charts';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { type RangeKey } from '../../../lib/time-range';
import { EvaluatorKind, type EvaluatorDetailDto, type EvaluatorOverviewDto } from '../../../api/models';
import { KIND_CATEGORY, passFractionSeries } from '../evaluatorMeta';
import { categoryColorVar, categoryText } from '../categoryClasses';
import { StatCell } from './StatCell';
import { cn } from '../../../lib/cn';

const RANGES: RangeKey[] = ['1h', '24h', '7d', '30d'];

interface Props {
  evaluator: EvaluatorDetailDto;
  overview: EvaluatorOverviewDto | null;
  range: RangeKey;
  onRangeChange: (r: RangeKey) => void;
}

/** Performance card: range toggle, KPI strip, and a pass-rate trend area chart. */
export function PerformancePanel({ evaluator: e, overview, range, onRangeChange }: Props) {
  const { t } = useLingui();
  const cat = KIND_CATEGORY[e.kind];
  const summary = overview?.summary;
  const isAgentic = e.kind === EvaluatorKind.Agentic;

  const passSeries = passFractionSeries(overview?.passRateTrend ?? []);
  const hasTrend = passSeries.length >= 2;

  return (
    <section className="bg-card rounded-lg shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-hairline">
        <span className="text-[10px] text-muted uppercase tracking-[0.09em] font-semibold"><Trans>Performance</Trans></span>
        <span className="text-[11px] text-muted font-mono">
          <Trans>{(summary?.totalEvaluations ?? 0).toLocaleString()} runs · {range}</Trans>
        </span>
        <SegmentedControl
          className="ml-auto"
          value={range}
          onChange={onRangeChange}
          segments={RANGES.map(r => ({ value: r, label: r }))}
        />
      </div>

      <div className="grid grid-cols-4 border-b border-hairline">
        <StatCell
          label={isAgentic ? t`Avg score` : t`Pass rate`}
          value={isAgentic
            ? (summary?.avgScore != null ? summary.avgScore.toFixed(2) : '—')
            : (summary?.overallPassRate != null ? fmtPct(summary.overallPassRate) : '—')}
          sub={t`vs prev period`}
          valueClass={categoryText[cat]}
          big
        />
        <StatCell label={t`Evaluations`} value={(summary?.totalEvaluations ?? 0).toLocaleString()} sub={t`executed`} valueClass={cn('text-primary')} />
        <StatCell label={t`Pass rate`} value={summary?.overallPassRate != null ? fmtPct(summary.overallPassRate) : '—'} sub={t`score ≥ acceptable`} valueClass={cn('text-success')} />
        <StatCell label={t`Avg latency`} value={summary?.avgLatencyMs != null ? fmtLatency(summary.avgLatencyMs) : '—'} sub={t`per evaluation`} valueClass={cn('text-teal')} last />
      </div>

      <div className="px-[18px] py-3.5">
        <div className="text-[10px] text-muted uppercase tracking-[0.08em] font-semibold mb-2"><Trans>Pass rate trend</Trans></div>
        {hasTrend ? (
          <AreaChart
            data={passSeries}
            width={860}
            height={130}
            color={categoryColorVar[cat]}
            // eslint-disable-next-line lingui/no-unlocalized-strings -- SVG gradient element id, not UI copy
            gradientId={`evalTrend-${e.id.slice(0, 8)}`}
            showAxis={false}
            showEndMarker
            formatValue={v => fmtPct(v)}
            tooltipLabelFn={i => new Date((overview?.passRateTrend ?? [])[i]?.bucketStart ?? '').toLocaleDateString()}
          />
        ) : (
          <div className="h-[130px] flex items-center justify-center text-muted text-[11.5px]"><Trans>Not enough data</Trans></div>
        )}
      </div>
    </section>
  );
}
