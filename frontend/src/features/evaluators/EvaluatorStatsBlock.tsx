import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { statisticsApi } from '../../api/statistics';
import { QUERY_KEYS } from '../../api/query-keys';
import { EvaluationScore, EvaluatorKind, type EvaluatorOverviewDto } from '../../api/models';
import { rangeFrom, bucketFor, type RangeKey } from '../../lib/time-range';
import { AreaChart, BarChart } from '../../components/charts';
import { fmtPct, fmtTokens } from '../../lib/format';
import { EmptyState } from '../../components/ui/EmptyState';

const SCORE_ORDER: EvaluationScore[] = [
  EvaluationScore.Terrible,
  EvaluationScore.Bad,
  EvaluationScore.Acceptable,
  EvaluationScore.Good,
  EvaluationScore.Excellent,
];

function fmtEur(v: number | null | undefined): string {
  if (v == null) return '—';
  if (v < 0.01) return '<€0.01';
  return `€${v.toFixed(2)}`;
}

function fmtScore(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${v.toFixed(1)} / 5`;
}

interface Props {
  evaluatorId: string;
  kind: EvaluatorKind;
  range: RangeKey;
  color: string;
}

export function EvaluatorStatsBlock({ evaluatorId, kind, range, color }: Props) {
  const params = useMemo(() => ({
    from: rangeFrom(range),
    to: new Date().toISOString(),
    bucket: bucketFor(range),
  }), [range]);

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.statisticsEvaluatorOverview(evaluatorId, range),
    queryFn: () => statisticsApi.evaluatorOverview(evaluatorId, params),
    retry: false,
  });

  if (isLoading) return <StatsBlockShell color={color}><LoadingPlaceholder/></StatsBlockShell>;
  if (isError || !data) return <StatsBlockShell color={color}><ErrorPlaceholder/></StatsBlockShell>;

  return <StatsBlockBody data={data} kind={kind} color={color} />;
}

function StatsBlockShell({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <section style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
      padding: '16px 18px', borderTop: `2px solid color-mix(in srgb, ${color} 22%, transparent)`,
    }}>
      {children}
    </section>
  );
}

function LoadingPlaceholder() {
  return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Loading statistics…</div>;
}

function ErrorPlaceholder() {
  return (
    <EmptyState title="Statistics unavailable" description="The statistics service is not yet wired for evaluators." />
  );
}

function StatsBlockBody({ data, kind, color }: { data: EvaluatorOverviewDto; kind: EvaluatorKind; color: string }) {
  const { summary, passRateTrend, scoreDistribution } = data;

  const passRateSeries = useMemo(
    () => passRateTrend.map(p => (p.total > 0 ? p.passed / p.total : 0)),
    [passRateTrend],
  );

  const distData = useMemo(() => {
    const byScore = new Map(scoreDistribution.map(b => [b.score, b.count]));
    return SCORE_ORDER.map(s => ({ label: s.slice(0, 4), value: byScore.get(s) ?? 0 }));
  }, [scoreDistribution]);

  const showCost = kind === EvaluatorKind.Agentic;
  const hasTrend = passRateSeries.length >= 2;
  const hasDist = scoreDistribution.some(b => b.count > 0);
  const hasAny = summary.totalEvaluations > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* KPI row */}
      <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '16px 18px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 12 }}>
          Performance
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <Kpi label="Evaluations" value={summary.totalEvaluations.toLocaleString()} color={color}/>
          <Kpi label="Avg score" value={fmtScore(summary.avgScore)} color={color}/>
          <Kpi label="Pass rate" value={summary.overallPassRate != null ? fmtPct(summary.overallPassRate) : '—'} color={color}/>
        </div>
      </section>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '16px 18px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 12 }}>
            Pass rate trend
          </div>
          {hasTrend ? (
            <AreaChart
              data={passRateSeries}
              width={420}
              height={140}
              color={color}
              gradientId={`evalTrend-${color.replace('#', '')}`}
              showAxis={false}
              showEndMarker
              formatValue={v => fmtPct(v)}
              tooltipLabelFn={i => new Date(passRateTrend[i].bucketStart).toLocaleDateString()}
            />
          ) : <EmptyChart label="Not enough data"/>}
        </section>
        <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '16px 18px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 12 }}>
            Score distribution
          </div>
          {hasDist ? (
            <BarChart
              data={distData}
              width={420}
              height={140}
              color={color}
              truncateAt={5}
              formatValue={v => v.toLocaleString()}
            />
          ) : <EmptyChart label={hasAny ? 'No scores yet' : 'No evaluations yet'}/>}
        </section>
      </div>

      {/* Cost row (Agentic only) */}
      {showCost && (
        <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '16px 18px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 12 }}>
            Cost (LLM judge)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            <Kpi label="Input tokens" value={summary.inputTokens != null ? fmtTokens(summary.inputTokens) : '—'} color={color}/>
            <Kpi label="Output tokens" value={summary.outputTokens != null ? fmtTokens(summary.outputTokens) : '—'} color={color}/>
            <Kpi label="Total cost" value={fmtEur(summary.totalCostEur)} color={color}/>
          </div>
        </section>
      )}
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'var(--bg-card-2)', borderRadius: 'var(--radius-md)', padding: '12px 14px', borderLeft: `2px solid color-mix(in srgb, ${color} 38%, transparent)` }}>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 11.5 }}>
      {label}
    </div>
  );
}
