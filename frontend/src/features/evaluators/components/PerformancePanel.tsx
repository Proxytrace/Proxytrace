import { cn } from '../../../lib/cn';
import { fmtPct, fmtLatency } from '../../../lib/format';
import { AreaChart } from '../../../components/charts';
import { type RangeKey } from '../../../lib/time-range';
import { EvaluatorKind, type EvaluatorDetailDto, type EvaluatorOverviewDto } from '../../../api/models';
import { KIND_CATEGORY, passFractionSeries } from '../evaluatorMeta';
import { categoryColorVar, categoryText } from '../categoryClasses';
import { StatCell } from './StatCell';

const RANGES: RangeKey[] = ['1h', '24h', '7d', '30d'];

interface Props {
  evaluator: EvaluatorDetailDto;
  overview: EvaluatorOverviewDto | null;
  range: RangeKey;
  onRangeChange: (r: RangeKey) => void;
}

/** Performance card: range toggle, KPI strip, and a pass-rate trend area chart. */
export function PerformancePanel({ evaluator: e, overview, range, onRangeChange }: Props) {
  const cat = KIND_CATEGORY[e.kind];
  const summary = overview?.summary;
  const isAgentic = e.kind === EvaluatorKind.Agentic;

  const passSeries = passFractionSeries(overview?.passRateTrend ?? []);
  const hasTrend = passSeries.length >= 2;

  return (
    <section className="bg-card rounded-lg shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-hairline">
        <span className="text-[10px] text-muted uppercase tracking-[0.09em] font-semibold">Performance</span>
        <span className="text-[11px] text-muted font-mono">
          {(summary?.totalEvaluations ?? 0).toLocaleString()} runs · {range}
        </span>
        <div className="ml-auto flex gap-0.5 p-[3px] bg-card-2 rounded-md">
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              aria-pressed={range === r}
              className={cn(
                'px-3 py-1 rounded-md text-[11px] font-medium border-0 cursor-pointer font-mono',
                range === r
                  ? 'bg-card text-primary shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_1px_2px_rgba(0,0,0,0.25)]'
                  : 'bg-transparent text-muted',
              )}
            >{r}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 border-b border-hairline">
        <StatCell
          label={isAgentic ? 'Avg score' : 'Pass rate'}
          value={isAgentic
            ? (summary?.avgScore != null ? summary.avgScore.toFixed(2) : '—')
            : (summary?.overallPassRate != null ? fmtPct(summary.overallPassRate) : '—')}
          sub="vs prev period"
          valueClass={categoryText[cat]}
          big
        />
        <StatCell label="Evaluations" value={(summary?.totalEvaluations ?? 0).toLocaleString()} sub="executed" valueClass="text-primary" />
        <StatCell label="Pass rate" value={summary?.overallPassRate != null ? fmtPct(summary.overallPassRate) : '—'} sub="score ≥ acceptable" valueClass="text-success" />
        <StatCell label="Avg latency" value={summary?.avgLatencyMs != null ? fmtLatency(summary.avgLatencyMs) : '—'} sub="per evaluation" valueClass="text-teal" last />
      </div>

      <div className="px-[18px] py-3.5">
        <div className="text-[10px] text-muted uppercase tracking-[0.08em] font-semibold mb-2">Pass rate trend</div>
        {hasTrend ? (
          <AreaChart
            data={passSeries}
            width={860}
            height={130}
            color={categoryColorVar[cat]}
            gradientId={`evalTrend-${e.id.slice(0, 8)}`}
            showAxis={false}
            showEndMarker
            formatValue={v => fmtPct(v)}
            tooltipLabelFn={i => new Date((overview?.passRateTrend ?? [])[i]?.bucketStart ?? '').toLocaleDateString()}
          />
        ) : (
          <div className="h-[130px] flex items-center justify-center text-muted text-[11.5px]">Not enough data</div>
        )}
      </div>
    </section>
  );
}
