import type { AgentOverviewDto } from '../../../api/models';
import { Sparkline } from '../../../components/charts';
import { Skeleton } from '../../../components/ui/Skeleton';
import { fmtLatency, fmtTokens, fmtCost } from '../../../lib/format';
import { rangeWindowLabel, type RangeKey } from '../../../lib/time-range';
import { summarizePassRate, passRateColor, passRateDelta } from '../passRate';
import { RangeTabs } from './RangeTabs';

interface Props {
  overview?: AgentOverviewDto;
  isLoading: boolean;
  range: RangeKey;
  onRangeChange: (r: RangeKey) => void;
  className?: string;
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
  const deltaColor = kpi.delta == null ? '' : kpi.delta >= 0 ? 'text-success' : 'text-danger';
  return (
    <div className="flex-1 min-w-[210px] border-l border-t border-hairline px-4 py-3 flex flex-col gap-1.5">
      <span className="text-caption text-muted font-semibold uppercase tracking-[0.07em]">{kpi.label}</span>
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
            {kpi.delta >= 0 ? '↑' : '↓'} {Math.abs(kpi.delta)}pt
          </span>
        )}
        {kpi.delta != null && ' · '}
        {kpi.sub}
      </span>
    </div>
  );
}

export function PerformanceCard({ overview, isLoading, range, onRangeChange, className }: Props) {
  const pass = overview ? summarizePassRate(overview.passRateTrend) : null;
  const passClr = pass?.overall != null ? passRateColor(pass.overall) : 'var(--text-muted)';
  const delta = overview ? passRateDelta(overview.passRateTrend) : null;
  const ts = overview?.timeSeries ?? [];
  const sum = overview?.summary;
  const win = rangeWindowLabel(range);

  const kpis: Kpi[] = [
    {
      label: 'Pass rate',
      value: pass?.overall != null ? `${Math.round(pass.overall)}%` : '—',
      sub: pass?.overall != null ? `${pass.totalPassed}/${pass.totalCases} cases` : 'no test data',
      valueColor: passClr,
      delta,
      spark: pass?.trendValues ?? [],
      sparkColor: passClr,
    },
    {
      label: 'Traces',
      value: String(sum?.totalTraces ?? 0),
      sub: `in ${win}`,
      spark: ts.map(p => p.traceCount),
      sparkColor: 'var(--accent-primary)',
    },
    {
      label: 'Tokens',
      value: sum ? fmtTokens(sum.totalInputTokens + sum.totalOutputTokens) : '—',
      sub: sum ? `${fmtTokens(sum.totalInputTokens)} in · ${fmtTokens(sum.totalOutputTokens)} out` : win,
      spark: ts.map(p => p.inputTokens + p.outputTokens),
      sparkColor: 'var(--teal)',
    },
    {
      label: 'Cost',
      value: sum ? fmtCost(sum.totalCostEur) : '—',
      sub: win,
      spark: ts.map(p => p.costEur),
      sparkColor: 'var(--warn)',
    },
    {
      label: 'Avg latency',
      value: sum ? fmtLatency(sum.avgLatencyMs) : '—',
      sub: 'per call',
      spark: ts.map(p => p.avgLatencyMs),
      sparkColor: 'var(--success)',
    },
  ];

  return (
    <section
      data-testid="agent-performance"
      className={`bg-card rounded-lg overflow-hidden shadow-[var(--shadow-card)] ${className ?? ''}`}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-hairline">
        <span className="text-h2 font-semibold tracking-[-0.005em]">Performance</span>
        <span className="inline-flex items-center gap-1.5 text-body-sm text-success">
          <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-success" />
          live
        </span>
        <div className="ml-auto">
          <RangeTabs value={range} onChange={onRangeChange} />
        </div>
      </div>
      {isLoading && !overview ? (
        <div className="flex flex-wrap p-2 gap-2">
          {kpis.map(k => <Skeleton key={k.label} height={72} className="flex-1 min-w-[210px] rounded-md" />)}
        </div>
      ) : (
        // Every cell carries a left+top hairline; the -1px offsets push the outer edges under the
        // section's overflow-hidden, so only internal dividers show — correct for any wrap count.
        <div className="flex flex-wrap -ml-px -mt-px">
          {kpis.map(k => <KpiCell key={k.label} kpi={k} />)}
        </div>
      )}
    </section>
  );
}
