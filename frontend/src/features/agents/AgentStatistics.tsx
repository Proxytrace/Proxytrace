import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { statisticsApi } from '../../api/statistics';
import { QUERY_KEYS } from '../../api/query-keys';
import { useTraceStream, useProposalStream } from '../../api/event-stream';
import { AreaChart } from '../../components/charts';
import { Collapsible } from '../../components/ui/Collapsible';
import { KpiCard } from '../../components/ui/KpiCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { rangeFrom, rangeLabel, bucketFor, RANGE_KEYS, type RangeKey } from '../../lib/time-range';
import { fmtCost, fmtLatency, fmtTokens, fmtRelative } from '../../lib/format';

interface Props { agentId: string; }

export function AgentStatistics({ agentId }: Props) {
  const qc = useQueryClient();
  const [range, setRange] = useState<RangeKey>('7d');

  const params = useMemo(() => ({
    from: rangeFrom(range),
    to: new Date().toISOString(),
    bucket: bucketFor(range),
  }), [range]);

  const { data: overview, isLoading } = useQuery({
    queryKey: QUERY_KEYS.agentStatsOverview(agentId, range),
    queryFn: () => statisticsApi.agentOverview(agentId, params),
  });

  useTraceStream(useCallback((evt) => {
    if (evt.agentId !== agentId) return;
    qc.invalidateQueries({ queryKey: QUERY_KEYS.agentStatsOverview(agentId, range) });
  }, [agentId, range, qc]));

  useProposalStream(agentId, useCallback(() => {
    qc.invalidateQueries({ queryKey: QUERY_KEYS.agentStatsOverview(agentId, range) });
    qc.invalidateQueries({ queryKey: QUERY_KEYS.agentCounts(agentId) });
  }, [agentId, range, qc]));

  return (
    <div className="bg-card rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
      <Collapsible
        defaultOpen
        headerClassName="px-4 py-3 border-b border-hairline gap-2"
        contentClassName="p-4"
        title={
          <div className="flex items-center justify-between flex-1 gap-3">
            <span className="text-[12.5px] font-semibold">Statistics</span>
            <span className="text-[11px] text-muted hidden md:inline">{rangeLabel(range)}</span>
            <div className="flex gap-1 p-1 bg-card-2 rounded-[10px] shrink-0">
              {RANGE_KEYS.map(r => (
                <button
                  key={r}
                  onClick={(e) => { e.stopPropagation(); setRange(r); }}
                  style={{
                    boxShadow: range === r ? '0 1px 0 rgba(255,255,255,0.06) inset, 0 1px 2px rgba(0,0,0,0.25)' : 'none',
                  }}
                  className={`px-[10px] py-[4px] text-[11px] font-medium rounded-[7px] cursor-pointer ${
                    range === r ? 'bg-card text-primary' : 'bg-transparent text-muted'
                  }`}
                >{r}</button>
              ))}
            </div>
          </div>
        }
      >
        {isLoading && <div className="text-center text-xs text-muted py-8">Loading…</div>}
        {!isLoading && overview && overview.summary.totalTraces === 0 && (
          <EmptyState
            title="No activity yet"
            description="Statistics appear once this agent is invoked."
          />
        )}
        {!isLoading && overview && overview.summary.totalTraces > 0 && (
          <StatsBody overview={overview} range={range} />
        )}
      </Collapsible>
    </div>
  );
}

function StatsBody({
  overview,
  range,
}: {
  overview: import('../../api/models').AgentOverviewDto;
  range: RangeKey;
}) {
  const traces = overview.timeSeries.map(p => p.traceCount);
  const tokens = overview.timeSeries.map(p => p.inputTokens + p.outputTokens);
  const costs = overview.timeSeries.map(p => p.costEur);
  const latencies = overview.timeSeries.map(p => p.avgLatencyMs);

  const totalTokens = overview.summary.totalInputTokens + overview.summary.totalOutputTokens;
  const passRateTrendValues = overview.passRateTrend.map(p =>
    p.testCases > 0 ? (p.passed / p.testCases) * 100 : 0
  );
  const overallPassRate =
    overview.passRateTrend.reduce((s, p) => s + p.testCases, 0) > 0
      ? (overview.passRateTrend.reduce((s, p) => s + p.passed, 0) /
         overview.passRateTrend.reduce((s, p) => s + p.testCases, 0)) * 100
      : null;

  return (
    <div className="flex flex-col gap-3">

      {/* KPI row */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <KpiCard
          title="Traces"
          value={String(overview.summary.totalTraces)}
          subtitle={`in ${rangeLabel(range).split(' · ')[0].toLowerCase()}`}
          sparkline={traces}
          sparklineColor="#c9944a"
          accent
        />
        <KpiCard
          title="Tokens"
          value={fmtTokens(totalTokens)}
          subtitle={`${fmtTokens(overview.summary.totalInputTokens)} in · ${fmtTokens(overview.summary.totalOutputTokens)} out`}
          sparkline={tokens}
          sparklineColor="#6b9eaa"
        />
        <KpiCard
          title="Cost"
          value={fmtCost(overview.summary.totalCostEur)}
          subtitle="cumulative across endpoints"
          sparkline={costs}
          sparklineColor="#d4915c"
        />
        <KpiCard
          title="Avg Latency"
          value={fmtLatency(overview.summary.avgLatencyMs)}
          subtitle="per call"
          sparkline={latencies}
          sparklineColor="#3daa6f"
        />
      </div>

      {/* Time-series row */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <ChartCard title="Traces over time">
          <AreaChart data={traces} width={420} height={140} color="#c9944a" gradientId={`agentTracesGrad`} showAxis={false} />
        </ChartCard>
        <ChartCard title="Tokens over time">
          <AreaChart data={tokens} width={420} height={140} color="#6b9eaa" gradientId={`agentTokensGrad`} showAxis={false} />
        </ChartCard>
        <ChartCard title="Cost over time">
          <AreaChart data={costs} width={420} height={140} color="#d4915c" gradientId={`agentCostGrad`} showAxis={false} />
        </ChartCard>
      </div>

      {/* Pass-rate row */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)' }}>
        <ChartCard
          title="Pass rate trend"
          right={overallPassRate !== null && (
            <span className="text-[11px] text-muted">overall {Math.round(overallPassRate)}%</span>
          )}
        >
          {passRateTrendValues.length >= 2 && passRateTrendValues.some(v => v > 0) ? (
            <AreaChart data={passRateTrendValues} width={420} height={140} color="#3daa6f" gradientId={`agentPassRateGrad`} showAxis={false} />
          ) : (
            <div className="flex items-center justify-center h-[140px] text-[12px] text-muted">No completed runs in range</div>
          )}
        </ChartCard>
        <ChartCard title="Latest suite pass rates">
          {overview.suitePassRates.length === 0 ? (
            <div className="flex items-center justify-center h-[140px] text-[12px] text-muted">No suite runs</div>
          ) : (
            <div className="flex flex-col gap-2 py-1">
              {overview.suitePassRates.map(s => {
                const pct = s.testCases > 0 ? (s.passed / s.testCases) * 100 : 0;
                return (
                  <div key={s.suiteId} className="flex flex-col gap-[3px]">
                    <div className="flex items-center justify-between gap-2 text-[11.5px]">
                      <span className="font-medium truncate">{s.suiteName}</span>
                      <span className="font-mono text-muted shrink-0">
                        {s.passed}/{s.testCases} · {Math.round(pct)}%
                      </span>
                    </div>
                    <div className="h-[5px] rounded-full bg-card-2 overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${pct}%`,
                          background: pct >= 80 ? '#3daa6f' : pct >= 50 ? '#c9944a' : '#d4915c',
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-muted">{fmtRelative(s.latestRunAt)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Counts row */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <CountTile label="Test Suites" value={String(overview.counts.suiteCount)} />
        <CountTile label="Test Cases" value={String(overview.counts.testCaseCount)} />
        <CountTile
          label="Proposals"
          value={`${overview.counts.openProposalCount} / ${overview.counts.totalProposalCount}`}
          subtitle="open / total"
        />
      </div>

    </div>
  );
}

function ChartCard({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card-2 rounded-xl p-3 flex flex-col gap-2" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] font-semibold text-secondary tracking-[0.02em]">{title}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

function CountTile({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div className="bg-card-2 rounded-xl p-3 flex flex-col gap-1" style={{ boxShadow: 'var(--shadow-card)' }}>
      <span className="text-[11px] text-muted font-medium">{label}</span>
      <span className="text-[20px] font-bold tracking-[-0.02em]">{value}</span>
      {subtitle && <span className="text-[10.5px] text-muted">{subtitle}</span>}
    </div>
  );
}
