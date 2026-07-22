import { Trans, useLingui } from '@lingui/react/macro';
import { AreaChart, BarChart } from '../../../components/charts';
import { fmtPct, fmtTokens, fmtLatency, cachedPct } from '../../../lib/format';
import { EvaluatorKind, type EvaluatorOverviewDto } from '../../../api/models';
import { SCORE_ORDER, fmtEur } from '../evaluatorMeta';
import { StatsBlockKpi, EmptyChart } from './StatsBlockKpi';
import { cn } from '../../../lib/cn';

function fmtScore(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${v.toFixed(1)} / 5`;
}

const sectionCls = cn('bg-card rounded-lg shadow-[var(--shadow-card)] px-4.5 py-4');
const sectionLabelCls = cn('text-body text-secondary uppercase tracking-[0.06em] font-semibold mb-3');

/** Renders the loaded stats block: KPI strip, trend + distribution charts, and (for LLM judges) cost. */
export function StatsBlockBody({ data, kind, color }: { data: EvaluatorOverviewDto; kind: EvaluatorKind; color: string }) {
  const { t } = useLingui();
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
        <div className={sectionLabelCls}><Trans>Performance</Trans></div>
        <div className="grid grid-cols-4 gap-3.5">
          <StatsBlockKpi label={t`Evaluations`} value={summary.totalEvaluations.toLocaleString()} color={color} />
          <StatsBlockKpi label={t`Avg score`} value={fmtScore(summary.avgScore)} color={color} />
          <StatsBlockKpi label={t`Pass rate`} value={summary.overallPassRate != null ? fmtPct(summary.overallPassRate) : '—'} color={color} />
          <StatsBlockKpi label={t`Avg latency`} value={summary.avgLatencyMs != null ? fmtLatency(summary.avgLatencyMs) : '—'} color={color} />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3.5">
        <section className={sectionCls}>
          <div className={sectionLabelCls}><Trans>Pass rate trend</Trans></div>
          {hasTrend ? (
            <AreaChart
              data={passRateSeries}
              width={420}
              height={140}
              color={color}
              showAxis={false}
              formatValue={v => fmtPct(v)}
              tooltipLabelFn={i => new Date(passRateTrend[i].bucketStart).toLocaleDateString()}
            />
          ) : <EmptyChart label={t`Not enough data`} />}
        </section>
        <section className={sectionCls}>
          <div className={sectionLabelCls}><Trans>Score distribution</Trans></div>
          {hasDist ? (
            <BarChart data={distData} width={420} height={140} color={color} truncateAt={5} formatValue={v => v.toLocaleString()} />
          ) : <EmptyChart label={hasAny ? t`No scores yet` : t`No evaluations yet`} />}
        </section>
      </div>

      {showCost && (
        <section className={sectionCls}>
          <div className={sectionLabelCls}><Trans>Cost (LLM judge)</Trans></div>
          <div className="grid grid-cols-3 gap-3.5">
            <StatsBlockKpi
              label={t`Input tokens`}
              value={summary.inputTokens != null
                ? (() => {
                    const cached = cachedPct(summary.cachedInputTokens ?? 0, summary.inputTokens);
                    return cached !== null ? t`${fmtTokens(summary.inputTokens)} · ${cached}% cached` : fmtTokens(summary.inputTokens);
                  })()
                : '—'}
              color={color}
            />
            <StatsBlockKpi label={t`Output tokens`} value={summary.outputTokens != null ? fmtTokens(summary.outputTokens) : '—'} color={color} />
            <StatsBlockKpi label={t`Total cost`} value={fmtEur(summary.totalCost)} color={color} />
          </div>
          <div className="mt-3.5">
            <div className="text-body-sm text-secondary uppercase tracking-[0.06em] font-semibold mb-2"><Trans>Cost over time</Trans></div>
            {hasCostTrend ? (
              <AreaChart
                data={costSeries}
                width={860}
                height={140}
                color={color}
                showAxis={false}
                formatValue={v => fmtEur(v)}
                tooltipLabelFn={i => new Date(costTrend[i].bucketStart).toLocaleDateString()}
              />
            ) : <EmptyChart label={t`Not enough data`} />}
          </div>
        </section>
      )}
    </div>
  );
}
