import { AreaChart, BarChart } from '../../../components/charts';
import { fmtPct, fmtTokens, fmtLatency } from '../../../lib/format';
import { EvaluatorKind, type EvaluatorOverviewDto } from '../../../api/models';
import { SCORE_ORDER, fmtEur } from '../evaluatorMeta';
import { StatsBlockKpi, EmptyChart } from './StatsBlockKpi';

function fmtScore(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${v.toFixed(1)} / 5`;
}

const sanitize = (color: string) => color.replace(/[^a-zA-Z0-9]/g, '');

const sectionCls = 'bg-card rounded-lg shadow-[var(--shadow-card)] px-[18px] py-4';
const sectionLabelCls = 'text-[12px] text-muted uppercase tracking-[0.06em] font-semibold mb-3';

/** Renders the loaded stats block: KPI strip, trend + distribution charts, and (for LLM judges) cost. */
export function StatsBlockBody({ data, kind, color }: { data: EvaluatorOverviewDto; kind: EvaluatorKind; color: string }) {
  const { summary, passRateTrend, scoreDistribution, costTrend } = data;

  const passRateSeries = passRateTrend.map(p => (p.total > 0 ? p.passed / p.total : 0));
  const costSeries = costTrend.map(p => Number(p.cost ?? 0));
  const distByScore = new Map(scoreDistribution.map(b => [b.score, b.count]));
  const distData = SCORE_ORDER.map(s => ({ label: s.slice(0, 4), value: distByScore.get(s) ?? 0 }));

  const showCost = kind === EvaluatorKind.Agentic;
  const hasTrend = passRateSeries.length >= 2;
  const hasCostTrend = showCost && costSeries.length >= 2 && costSeries.some(v => v > 0);
  const hasDist = scoreDistribution.some(b => b.count > 0);
  const hasAny = summary.totalEvaluations > 0;

  return (
    <div className="flex flex-col gap-3.5">
      <section className={sectionCls}>
        <div className={sectionLabelCls}>Performance</div>
        <div className="grid grid-cols-4 gap-3.5">
          <StatsBlockKpi label="Evaluations" value={summary.totalEvaluations.toLocaleString()} color={color} />
          <StatsBlockKpi label="Avg score" value={fmtScore(summary.avgScore)} color={color} />
          <StatsBlockKpi label="Pass rate" value={summary.overallPassRate != null ? fmtPct(summary.overallPassRate) : '—'} color={color} />
          <StatsBlockKpi label="Avg latency" value={summary.avgLatencyMs != null ? fmtLatency(summary.avgLatencyMs) : '—'} color={color} />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3.5">
        <section className={sectionCls}>
          <div className={sectionLabelCls}>Pass rate trend</div>
          {hasTrend ? (
            <AreaChart
              data={passRateSeries}
              width={420}
              height={140}
              color={color}
              gradientId={`evalTrend-${sanitize(color)}`}
              showAxis={false}
              showEndMarker
              formatValue={v => fmtPct(v)}
              tooltipLabelFn={i => new Date(passRateTrend[i].bucketStart).toLocaleDateString()}
            />
          ) : <EmptyChart label="Not enough data" />}
        </section>
        <section className={sectionCls}>
          <div className={sectionLabelCls}>Score distribution</div>
          {hasDist ? (
            <BarChart data={distData} width={420} height={140} color={color} truncateAt={5} formatValue={v => v.toLocaleString()} />
          ) : <EmptyChart label={hasAny ? 'No scores yet' : 'No evaluations yet'} />}
        </section>
      </div>

      {showCost && (
        <section className={sectionCls}>
          <div className={sectionLabelCls}>Cost (LLM judge)</div>
          <div className="grid grid-cols-3 gap-3.5">
            <StatsBlockKpi label="Input tokens" value={summary.inputTokens != null ? fmtTokens(summary.inputTokens) : '—'} color={color} />
            <StatsBlockKpi label="Output tokens" value={summary.outputTokens != null ? fmtTokens(summary.outputTokens) : '—'} color={color} />
            <StatsBlockKpi label="Total cost" value={fmtEur(summary.totalCost)} color={color} />
          </div>
          <div className="mt-3.5">
            <div className="text-[11px] text-muted uppercase tracking-[0.06em] font-semibold mb-2">Cost over time</div>
            {hasCostTrend ? (
              <AreaChart
                data={costSeries}
                width={860}
                height={140}
                color={color}
                gradientId={`evalCost-${sanitize(color)}`}
                showAxis={false}
                showEndMarker
                formatValue={v => fmtEur(v)}
                tooltipLabelFn={i => new Date(costTrend[i].bucketStart).toLocaleDateString()}
              />
            ) : <EmptyChart label="Not enough data" />}
          </div>
        </section>
      )}
    </div>
  );
}
