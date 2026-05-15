import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { statisticsApi } from '../../api/statistics';
import { agentCallsApi } from '../../api/agent-calls';
import { agentsApi } from '../../api/agents';
import { QUERY_KEYS } from '../../api/query-keys';
import { useCurrentProject } from '../../contexts/ProjectContext';
import { SparklesIcon, ActivityIcon, CoinsIcon, ClockIcon, TargetIcon } from '../../components/icons';
import type { AgentCallDto } from '../../api/models';
import { KpiCard } from '../../components/ui/KpiCard';
import { Pill } from '../../components/ui/Pill';
import { StatusDot } from '../../components/ui/StatusDot';
import { EmptyState } from '../../components/ui/EmptyState';
import { DataTable } from '../../components/ui/DataTable';
import type { DataColumn } from '../../components/ui/DataTable';
import { AreaChart, BarChart } from '../../components/charts';
import { rangeFrom, rangeLabel, type RangeKey } from '../../lib/time-range';
import { modelColor } from '../../lib/colors';
import { fmtLatency, fmtTokens, fmtRelative } from '../../lib/format';
import { REFETCH_INTERVAL_FAST, REFETCH_INTERVAL_SLOW } from '../../lib/constants';

// ── Recent trace columns ──────────────────────────────────────────────────────

const DASHBOARD_TRACE_COLUMNS: DataColumn<AgentCallDto>[] = [
  { key: 'id',      label: 'Trace ID', width: '1.6fr', render: t => <span className="mono text-xs text-primary truncate">{t.id.slice(0, 13)}…</span> },
  { key: 'model',   label: 'Model',    width: '1.4fr', render: t => <Pill label={t.model} color={modelColor(t.model)} size="sm" /> },
  { key: 'status',  label: 'Status',   width: '0.7fr', render: t => <StatusDot httpStatus={t.httpStatus} /> },
  { key: 'tokens',  label: 'Tokens',   width: '0.8fr', render: t => <span className="mono text-[11px] text-secondary">{fmtTokens(t.inputTokens + t.outputTokens)}</span> },
  { key: 'latency', label: 'Latency',  width: '0.9fr', render: t => <span className="mono text-[11px] text-secondary">{fmtLatency(t.durationMs)}</span> },
  { key: 'time',    label: '',         width: '0.3fr', className: 'text-right', render: t => <span className="text-[11px] text-muted text-right">{fmtRelative(t.createdAt)}</span> },
];

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>('24h');
  const from = useMemo(() => rangeFrom(range), [range]);
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;
  const enabled = currentProjectId !== null;

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: QUERY_KEYS.statisticsSummary(from, projectId),
    queryFn: () => statisticsApi.summary({ from, projectId }),
    refetchInterval: REFETCH_INTERVAL_FAST,
    enabled,
  });

  const { data: tracesData, isLoading: tracesLoading } = useQuery({
    queryKey: QUERY_KEYS.agentCalls({ page: 1, pageSize: 7, from, projectId }),
    queryFn: () => agentCallsApi.list({ page: 1, pageSize: 7, from, projectId }),
    refetchInterval: REFETCH_INTERVAL_FAST,
    enabled,
  });

  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: QUERY_KEYS.agents(projectId),
    queryFn: () => agentsApi.list({ projectId, pageSize: 10 }),
    refetchInterval: REFETCH_INTERVAL_SLOW,
    enabled,
  });

  const { data: latencyData } = useQuery({
    queryKey: QUERY_KEYS.statisticsLatency(from, undefined, projectId),
    queryFn: () => statisticsApi.latency({ from, projectId }),
    refetchInterval: REFETCH_INTERVAL_FAST,
    enabled,
  });

  const { data: modelBreakdown, isLoading: modelLoading } = useQuery({
    queryKey: QUERY_KEYS.statisticsModelBreakdown(from, undefined, projectId),
    queryFn: () => statisticsApi.modelBreakdown({ from, projectId }),
    refetchInterval: REFETCH_INTERVAL_FAST,
    enabled,
  });

  const { data: tokenUsageData } = useQuery({
    queryKey: QUERY_KEYS.statisticsTokenUsage(from, undefined, projectId),
    queryFn: () => statisticsApi.tokenUsage({ from, projectId }),
    refetchInterval: REFETCH_INTERVAL_FAST,
    enabled,
  });

  const { data: passRatesData } = useQuery({
    queryKey: QUERY_KEYS.statisticsPassRates(from, undefined, projectId),
    queryFn: () => statisticsApi.passRates({ from, projectId }),
    refetchInterval: REFETCH_INTERVAL_FAST,
    enabled,
  });

  const recentTraces = tracesData?.items ?? [];
  const agents = agentsData?.items ?? [];

  const latencyStats = useMemo(() => {
    if (!latencyData || latencyData.length === 0) return null;
    const totalSamples = latencyData.reduce((s, d) => s + d.sampleCount, 0) || 1;
    return {
      p50: Math.round(latencyData.reduce((s, d) => s + d.p50Ms * d.sampleCount, 0) / totalSamples),
      p95: Math.round(latencyData.reduce((s, d) => s + d.p95Ms * d.sampleCount, 0) / totalSamples),
      p99: Math.round(latencyData.reduce((s, d) => s + d.p99Ms * d.sampleCount, 0) / totalSamples),
    };
  }, [latencyData]);

  const modelBarItems = useMemo(
    () => (modelBreakdown ?? []).map(m => ({
      label: m.modelName,
      value: m.totalInputTokens + m.totalOutputTokens,
    })),
    [modelBreakdown],
  );

  const tokenVolume = useMemo(() => {
    if (!tokenUsageData) return { values: [] as number[], dates: [] as string[] };
    const byDate = new Map<string, number>();
    for (const r of tokenUsageData) {
      byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.inputTokens + r.outputTokens);
    }
    const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
    return { values: sorted.map(([, v]) => v), dates: sorted.map(([d]) => d) };
  }, [tokenUsageData]);
  const tokenVolumeSeries = tokenVolume.values;

  const endpointNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of modelBreakdown ?? []) m.set(r.endpointId, r.modelName);
    return m;
  }, [modelBreakdown]);

  const latencyBarItems = useMemo(
    () => (latencyData ?? []).map(d => ({
      label: endpointNameById.get(d.endpointId) ?? d.endpointId.slice(0, 6),
      value: Math.round(d.p95Ms),
    })),
    [latencyData, endpointNameById],
  );

  const passRateRuns = useMemo(() => {
    if (!passRatesData) return [];
    return [...passRatesData]
      .sort((a, b) => a.runTimestamp.localeCompare(b.runTimestamp))
      .map(r => {
        const total = r.passCount + r.failCount;
        return { timestamp: r.runTimestamp, pct: total > 0 ? (r.passCount / total) * 100 : 0 };
      });
  }, [passRatesData]);

  const passRateSeries = useMemo(() => passRateRuns.map(r => r.pct), [passRateRuns]);

  const totalTokens = (summary?.totalInputTokens ?? 0) + (summary?.totalOutputTokens ?? 0);

  return (
    <div className="w-full min-w-0 flex flex-col gap-3">

      {/* KPI Row */}
      <div className="fade-up grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<ActivityIcon size={14} />}
          title="Total Traces"
          value={summaryLoading ? '…' : String(summary?.totalCalls ?? 0)}
          subtitle="LLM calls captured"
          trend={{ direction: 'up', pct: '+24%', positive: true }}
        />
        <KpiCard
          icon={<CoinsIcon size={14} />}
          title="Total Tokens"
          value={summaryLoading ? '…' : fmtTokens(totalTokens)}
          subtitle={summaryLoading ? '' : `${(summary?.totalInputTokens ?? 0).toLocaleString()} in · ${(summary?.totalOutputTokens ?? 0).toLocaleString()} out`}
          trend={{ direction: 'up', pct: '+12%', positive: true }}
        />
        <KpiCard
          icon={<ClockIcon size={14} />}
          title="Avg Latency"
          value={summaryLoading ? '…' : fmtLatency(summary?.avgLatencyMs ?? 0)}
          subtitle={latencyStats ? `p95 ${fmtLatency(latencyStats.p95)} · p99 ${fmtLatency(latencyStats.p99)}` : ''}
          trend={{ direction: 'down', pct: '-8%', positive: false }}
        />
        <KpiCard
          icon={<TargetIcon size={14} />}
          title="Pass Rate"
          value={summaryLoading ? '…' : `${Math.round((summary?.overallPassRate ?? 0) * 100)}%`}
          subtitle="latest evaluation suite run"
          trend={{ direction: 'up', pct: '+7pt', positive: true }}
        />
      </div>

      {/* Charts Row 1: Token Volume + p95 by Endpoint */}
      <div className="fade-up grid grid-cols-1 lg:grid-cols-12 gap-3">

        {/* Token Volume area chart */}
        <div className="dash-card lg:col-span-8">
          <div className="card-header">
            <div className="min-w-0 flex-1">
              <h3>Token Volume</h3>
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-[2px] inline-block" style={{ background: '#c9944a' }} />
                Tokens · {rangeLabel(range)}
              </p>
            </div>
            <div className="flex gap-1 p-1 bg-card-2 rounded-[9px] shrink-0" role="group" aria-label="Time range">
              {(['1h', '24h', '7d', '30d'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  aria-pressed={range === r}
                  style={{
                    boxShadow: range === r ? '0 1px 0 rgba(255,255,255,0.06) inset, 0 1px 2px rgba(0,0,0,0.25)' : 'none',
                  }}
                  className={`px-[10px] py-[4px] text-[11px] font-medium rounded-[6px] cursor-pointer transition-colors duration-150 ${
                    range === r ? 'bg-card text-primary' : 'bg-transparent text-muted hover:text-secondary'
                  }`}
                >{r}</button>
              ))}
            </div>
          </div>
          <div className="px-[18px] pb-[14px] pt-2">
            {tokenVolumeSeries.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center">
                <EmptyState title="No data yet" description="Token volume will appear once traces are captured." />
              </div>
            ) : (
              <AreaChart
                data={tokenVolumeSeries}
                width={820}
                height={200}
                color="#c9944a"
                gradientId="volGrad"
                formatValue={v => `${fmtTokens(v)} tokens`}
                tooltipLabelFn={i => tokenVolume.dates[i] ?? ''}
              />
            )}
          </div>
        </div>

        {/* Latency by Endpoint */}
        <div className="dash-card lg:col-span-4">
          <div className="card-header">
            <div className="min-w-0 flex-1">
              <h3>p95 by Endpoint</h3>
              <p>{latencyData ? `${latencyData.reduce((s, d) => s + d.sampleCount, 0)} samples` : 'Loading…'}</p>
            </div>
            <div className="flex gap-3 shrink-0">
              {(latencyStats
                ? [['p50', fmtLatency(latencyStats.p50)], ['p95', fmtLatency(latencyStats.p95)], ['p99', fmtLatency(latencyStats.p99)]]
                : [['p50', '—'], ['p95', '—'], ['p99', '—']]
              ).map(([k, v]) => (
                <div key={k} className="text-right">
                  <div className="text-[10px] text-muted font-medium tracking-[0.05em] uppercase">{k}</div>
                  <div className="mono text-[12px] font-semibold mt-[1px]">{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="px-[18px] pb-[14px] pt-2">
            {latencyBarItems.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center">
                <EmptyState title="No samples" description="Latency stats appear after traces arrive." />
              </div>
            ) : (
              <BarChart data={latencyBarItems} width={360} height={200} color="#6b9eaa" formatValue={v => `p95 ${fmtLatency(v)}`} />
            )}
          </div>
        </div>
      </div>

      {/* Charts Row 2: Token Usage by Model + Pass Rate */}
      <div className="fade-up grid grid-cols-1 lg:grid-cols-12 gap-3">

        {/* Token Usage by Model */}
        <div className="dash-card lg:col-span-8">
          <div className="card-header">
            <div className="min-w-0 flex-1">
              <h3>Token Usage by Model</h3>
              <p>Total tokens per model · {rangeLabel(range).split(' · ')[0].toLowerCase()}</p>
            </div>
          </div>
          <div className="px-[18px] pb-[14px] pt-2">
            {modelLoading && (
              <div className="h-[200px] flex items-center justify-center text-xs text-muted">Loading…</div>
            )}
            {!modelLoading && modelBarItems.length === 0 && (
              <div className="h-[200px] flex items-center justify-center">
                <EmptyState title="No data yet" description="Token usage will appear once traces are captured." />
              </div>
            )}
            {!modelLoading && modelBarItems.length > 0 && (
              <BarChart data={modelBarItems} width={820} height={200} color="#c9944a" formatValue={v => `${fmtTokens(v)} tokens`} />
            )}
          </div>
        </div>

        {/* Pass Rate Over Runs */}
        <div className="dash-card lg:col-span-4">
          <div className="card-header">
            <div className="min-w-0 flex-1">
              <h3>Pass Rate</h3>
              <p>Latest evaluation suite · +7pt vs prev</p>
            </div>
          </div>
          <div className="px-[18px] pb-[14px] pt-2 flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <svg width="72" height="72" style={{ display: 'block', transform: 'rotate(-90deg)', flexShrink: 0 }}>
                <circle cx="36" cy="36" r="32" fill="none" stroke="#343438" strokeWidth="6" />
                <circle
                  cx="36" cy="36" r="32" fill="none" stroke="#3daa6f" strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 32}
                  strokeDashoffset={2 * Math.PI * 32 - (summary?.overallPassRate ?? 0) * 2 * Math.PI * 32}
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              </svg>
              <div className="min-w-0">
                <div className="text-[28px] font-bold tracking-[-0.02em] text-success leading-none">
                  {Math.round((summary?.overallPassRate ?? 0) * 100)}<span className="text-[16px] text-muted">%</span>
                </div>
                <div className="text-[11px] text-muted mt-1">{passRateRuns.length} run{passRateRuns.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
            {passRateSeries.length === 0 ? (
              <div className="h-[100px] flex items-center justify-center">
                <EmptyState title="No runs yet" description="Pass rate trend appears after suite runs complete." />
              </div>
            ) : (
              <div>
                <AreaChart
                  data={passRateSeries}
                  width={360}
                  height={100}
                  color="#3daa6f"
                  gradientId="passGrad"
                  showAxis={false}
                  formatValue={v => `${v.toFixed(1)}% pass`}
                  tooltipLabelFn={i => fmtRelative(passRateRuns[i]?.timestamp ?? '')}
                />
                <div className="flex justify-between text-[10px] text-muted mt-1 font-mono">
                  <span>{fmtRelative(passRateRuns[0].timestamp)}</span>
                  <span>{fmtRelative(passRateRuns[passRateRuns.length - 1].timestamp)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Traces + Agents */}
      <div className="fade-up grid grid-cols-1 lg:grid-cols-12 gap-3">

        {/* Recent Traces */}
        <div className="dash-card lg:col-span-8">
          <div className="card-header">
            <div className="min-w-0 flex-1"><h3>Recent Traces</h3></div>
            <Link to="/traces" className="text-xs text-accent-hover font-medium pr-[18px] whitespace-nowrap no-underline">View all →</Link>
          </div>
          <div className="card-body-flush">
            {tracesLoading && (
              <div className="p-8 px-[18px] text-center text-xs text-muted">Loading…</div>
            )}
            {!tracesLoading && (
              <DataTable
                columns={DASHBOARD_TRACE_COLUMNS}
                rows={recentTraces}
                rowKey={t => t.id}
                onRowClick={t => navigate(`/traces?focus=${t.id}`)}
                emptySlot={
                  <div className="py-10 px-[18px] text-center">
                    <p className="text-[13px] text-secondary m-0 mb-1">No traces yet</p>
                    <p className="text-xs text-muted m-0">Route your agent through the Trsr proxy to start capturing traces.</p>
                  </div>
                }
              />
            )}
          </div>
        </div>

        {/* Agent Cards */}
        <div className="dash-card lg:col-span-4">
          <div className="card-header">
            <div className="min-w-0 flex-1">
              <h3>Agents</h3>
              <p>Detected from traces</p>
            </div>
          </div>
          <div className="card-body flex flex-col gap-[10px] px-[18px] py-[14px]">
            {agentsLoading && (
              <div className="text-center text-xs text-muted py-8">Loading…</div>
            )}
            {!agentsLoading && agents.length === 0 && (
              <EmptyState
                title="No agents yet"
                description="Agents are detected automatically when you route traffic through the Trsr proxy."
              />
            )}
            {agents.map(agent => (
              <Link
                key={agent.id}
                to={`/agents?id=${agent.id}`}
                className="grid p-3 bg-card-2 rounded-xl items-center gap-3 cursor-pointer no-underline text-inherit transition-colors duration-150 hover:bg-[rgba(255,255,255,0.05)]"
                style={{ gridTemplateColumns: '1fr auto', boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 1px 2px rgba(0,0,0,0.25)' }}
              >
                <div className="min-w-0">
                  <span className="text-[13px] font-semibold truncate block">{agent.name}</span>
                  <div className="mt-[5px] flex gap-1.5 items-center flex-wrap">
                    <span className="text-[11px] text-muted">{agent.projectName}</span>
                    {agent.tools.length > 0 && (
                      <span className="text-[11px] text-muted">· {agent.tools.length} tool{agent.tools.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
                <div className="text-right text-[11px] text-muted whitespace-nowrap shrink-0">
                  {agent.lastUsedAt ? fmtRelative(agent.lastUsedAt) : 'never'}
                </div>
              </Link>
            ))}

            {/* Proposals teaser */}
            <div className="flex gap-2.5 items-start p-3 rounded-lg mt-1" style={{ background: 'linear-gradient(135deg, var(--accent-subtle), color-mix(in srgb, var(--teal) 8%, transparent))', boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 2px 4px rgba(0,0,0,0.2)' }}>
              <div className="w-7 h-7 rounded-sm shrink-0 flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--teal))' }}>
                <SparklesIcon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold">2 optimization proposals ready</div>
                <div className="text-[11px] text-secondary mt-[2px]">Est. +14% pass rate for Customer Support</div>
              </div>
              <button className="text-[11px] font-semibold text-accent-hover px-[10px] py-[5px] rounded-md bg-accent-subtle cursor-pointer whitespace-nowrap shrink-0">Review</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
