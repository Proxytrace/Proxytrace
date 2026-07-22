import { useLingui } from '@lingui/react/macro';
import type { AgentOverviewDto } from '../../../api/models';
import { Sparkline } from '../../../components/charts';
import { Skeleton } from '../../../components/ui/Skeleton';
import { cn } from '../../../lib/cn';
import { fmtLatency, fmtTokens, fmtCost, cachedPct } from '../../../lib/format';
import { rangeWindowLabel, type RangeKey } from '../../../lib/time-range';
import { summarizePassRate, passRateColor, passRateDelta } from '../passRate';
import { STAT_CELL_CLS } from './statCells';

interface Props {
  overview?: AgentOverviewDto;
  isLoading: boolean;
  range: RangeKey;
}

interface Kpi {
  label: string;
  value: string;
  sub: string;
  valueColor?: string;
  delta?: number | null;
  spark: number[];
  sparkColor: string;
}

function KpiCell({ kpi }: { kpi: Kpi }) {
  const hasSpark = kpi.spark.length >= 2 && kpi.spark.some(v => v > 0);
  const deltaColor = kpi.delta == null ? '' : kpi.delta >= 0 ? cn('text-success') : cn('text-danger');
  return (
    <div className={STAT_CELL_CLS}>
      <span className="text-caption text-secondary font-semibold uppercase tracking-[0.07em]">{kpi.label}</span>
      <div className="flex items-end justify-between gap-2">
        <span
          className="text-display font-semibold tracking-[-0.02em] leading-none"
          style={kpi.valueColor ? { color: kpi.valueColor } : undefined}
        >
          {kpi.value}
        </span>
        {hasSpark && (
          <Sparkline data={kpi.spark} color={kpi.sparkColor} width={68} height={28} strokeWidth={1.75} opacity={1} />
        )}
      </div>
      <span className="text-caption text-muted truncate">
        {kpi.delta != null && (
          <span className={`font-semibold ${deltaColor}`}>
            {/* eslint-disable-next-line lingui/no-unlocalized-strings -- compact metric unit suffix (percentage points) */}
            {kpi.delta >= 0 ? '↑' : '↓'} {Math.abs(kpi.delta)}pt
          </span>
        )}
        {kpi.delta != null && ' · '}
        {kpi.sub}
      </span>
    </div>
  );
}

/** Totals cards for the Performance card: aggregates over the window, each with a trend sparkline.
 *  Returned as bare cards so they share the one stat grid with the distribution cards. */
export function TrendStats({ overview, isLoading, range }: Props) {
  const { t } = useLingui();
  const pass = overview ? summarizePassRate(overview.passRateTrend) : null;
  const passClr = pass?.overall != null ? passRateColor(pass.overall) : 'var(--text-muted)';
  const delta = overview ? passRateDelta(overview.passRateTrend) : null;
  const ts = overview?.timeSeries ?? [];
  const sum = overview?.summary;
  const win = rangeWindowLabel(range);

  const kpis: Kpi[] = [
    {
      label: t`Pass rate`,
      value: pass?.overall != null ? `${Math.round(pass.overall)}%` : '—',
      sub: pass?.overall != null ? t`${pass.totalPassed}/${pass.totalCases} cases` : t`no test data`,
      valueColor: passClr,
      delta,
      spark: pass?.trendValues ?? [],
      sparkColor: passClr,
    },
    {
      label: t`Traces`,
      value: String(sum?.totalTraces ?? 0),
      sub: t`in ${win}`,
      spark: ts.map(p => p.traceCount),
      sparkColor: 'var(--accent-primary)',
    },
    {
      label: t`Tokens`,
      value: sum ? fmtTokens(sum.totalInputTokens + sum.totalOutputTokens) : '—',
      sub: sum
        ? (() => {
            const cached = cachedPct(sum.totalCachedInputTokens, sum.totalInputTokens);
            return cached !== null
              ? t`${fmtTokens(sum.totalInputTokens)} in · ${fmtTokens(sum.totalOutputTokens)} out · ${cached}% cached`
              : t`${fmtTokens(sum.totalInputTokens)} in · ${fmtTokens(sum.totalOutputTokens)} out`;
          })()
        : win,
      spark: ts.map(p => p.inputTokens + p.outputTokens),
      sparkColor: 'var(--teal)',
    },
    {
      label: t`Cost`,
      value: sum ? fmtCost(sum.totalCostEur) : '—',
      sub: win,
      spark: ts.map(p => p.costEur),
      sparkColor: 'var(--warn)',
    },
    {
      label: t`Avg latency`,
      value: sum ? fmtLatency(sum.avgLatencyMs) : '—',
      sub: t`per call`,
      spark: ts.map(p => p.avgLatencyMs),
      sparkColor: 'var(--success)',
    },
  ];

  if (isLoading && !overview) {
    return <>{kpis.map(k => <Skeleton key={k.label} height={86} className="rounded-lg" />)}</>;
  }

  return <>{kpis.map(k => <KpiCell key={k.label} kpi={k} />)}</>;
}
