import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { statisticsApi } from '../../api/statistics';
import { agentCallsApi } from '../../api/agent-calls';
import { agentsApi } from '../../api/agents';
import { QUERY_KEYS } from '../../api/query-keys';
import { useCurrentProject } from '../../contexts/ProjectContext';
import { SparklesIcon } from '../../components/icons';
import type { AgentCallDto } from '../../api/models';
import { KpiCard } from '../../components/ui/KpiCard';
import { Pill } from '../../components/ui/Pill';
import { StatusDot } from '../../components/ui/StatusDot';
import { EmptyState } from '../../components/ui/EmptyState';
import { DataTable } from '../../components/ui/DataTable';
import type { DataColumn } from '../../components/ui/DataTable';
import { AreaChart, Histogram, BarChart } from '../../components/charts';
import { rangeFrom, rangeLabel, type RangeKey } from '../../lib/time-range';
import { modelColor } from '../../lib/colors';
import { fmtLatency, fmtTokens, fmtRelative } from '../../lib/format';
import { REFETCH_INTERVAL_FAST, REFETCH_INTERVAL_SLOW } from '../../lib/constants';

// ── Static fallback data (no time-series API exists yet) ──────────────────────

const VOLUME_RAW = [2, 4, 3, 1, 0, 2, 5, 8, 12, 18, 14, 22, 28, 34, 29, 36, 40, 32, 26, 20, 14, 18, 22, 15];
const LATENCY_HIST_RAW = [3, 8, 22, 45, 38, 28, 15, 9, 4, 2];
const PASS_RATE_RAW = [42, 55, 61, 68, 72, 78, 82, 85];

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
  const [range, setRange] = useState<RangeKey>('24h');
  const from = rangeFrom(range);
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

  const passRateRing = useMemo(() => {
    const r = 37;
    const circumference = 2 * Math.PI * r;
    const passRate = summary?.overallPassRate ?? 0;
    return { circumference, dashoffset: circumference - passRate * circumference };
  }, [summary?.overallPassRate]);

  const totalTokens = (summary?.totalInputTokens ?? 0) + (summary?.totalOutputTokens ?? 0);

  return (
    <div className="w-full max-w-[1480px] mx-auto min-w-0 min-h-0 flex-1 flex flex-col gap-4 overflow-y-auto pb-6">

      {/* KPI Row */}
      <div className="fade-up grid gap-3" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <KpiCard
          title="Total Traces"
          value={summaryLoading ? '…' : String(summary?.totalCalls ?? 0)}
          subtitle="LLM calls captured"
          trend={{ direction: 'up', pct: '+24%', positive: true }}
          sparkline={VOLUME_RAW}
          sparklineColor="#c9944a"
        />
        <KpiCard
          title="Total Tokens"
          value={summaryLoading ? '…' : fmtTokens(totalTokens)}
          subtitle={summaryLoading ? '' : `${(summary?.totalInputTokens ?? 0).toLocaleString()} in · ${(summary?.totalOutputTokens ?? 0).toLocaleString()} out`}
          trend={{ direction: 'up', pct: '+12%', positive: true }}
          sparklineColor="#6b9eaa"
        />
        <KpiCard
          title="Avg Latency"
          value={summaryLoading ? '…' : fmtLatency(summary?.avgLatencyMs ?? 0)}
          subtitle={latencyStats ? `p95 ${fmtLatency(latencyStats.p95)} · p99 ${fmtLatency(latencyStats.p99)}` : ''}
          trend={{ direction: 'down', pct: '-8%', positive: false }}
          sparklineColor="#d4915c"
        />
        <KpiCard
          title="Pass Rate"
          value={summaryLoading ? '…' : `${Math.round((summary?.overallPassRate ?? 0) * 100)}%`}
          subtitle="latest evaluation suite run"
          trend={{ direction: 'up', pct: '+7pt', positive: true }}
          sparkline={PASS_RATE_RAW}
          sparklineColor="#3daa6f"
        />
      </div>

      {/* Charts Row 1: Trace Volume + Latency Distribution */}
      <div className="fade-up grid gap-3" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)' }}>

        {/* Trace Volume area chart */}
        <div className="dash-card">
          <div className="card-header">
            <div className="min-w-0 flex-1">
              <h3>Trace Volume</h3>
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-[2px] inline-block" style={{ background: '#c9944a' }} />
                Traces · {rangeLabel(range)}
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
          <div className="card-body px-[18px] pb-[18px] pt-0">
            <AreaChart
              data={VOLUME_RAW}
              width={820}
              height={240}
              color="#c9944a"
              gradientId="volGrad"
            />
          </div>
        </div>

        {/* Latency Distribution histogram */}
        <div className="dash-card">
          <div className="card-header">
            <div className="min-w-0 flex-1">
              <h3>Latency Distribution</h3>
              <p>{latencyData ? `${latencyData.reduce((s, d) => s + d.sampleCount, 0)} samples` : 'Loading…'}</p>
            </div>
          </div>
          <div className="card-body">
            <Histogram data={LATENCY_HIST_RAW} width={360} height={200} color="#6b9eaa" />
            <div className="flex gap-4 mt-3 pt-3 border-t border-border-subtle">
              {(latencyStats
                ? [['p50', fmtLatency(latencyStats.p50)], ['p95', fmtLatency(latencyStats.p95)], ['p99', fmtLatency(latencyStats.p99)]]
                : [['p50', '—'], ['p95', '—'], ['p99', '—']]
              ).map(([k, v]) => (
                <div key={k}>
                  <div className="text-[11px] text-muted font-medium tracking-[0.05em] uppercase">{k}</div>
                  <div className="mono text-sm font-semibold mt-[2px]">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 2: Token Usage + Pass Rate */}
      <div className="fade-up grid gap-3" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)' }}>

        {/* Token Usage by Model */}
        <div className="dash-card">
          <div className="card-header">
            <div className="min-w-0 flex-1">
              <h3>Token Usage by Model</h3>
              <p>Total tokens per model · {rangeLabel(range).split(' · ')[0].toLowerCase()}</p>
            </div>
          </div>
          <div className="card-body px-[18px] pb-[18px] pt-0">
            {modelLoading && (
              <div className="h-[220px] flex items-center justify-center text-xs text-muted">Loading…</div>
            )}
            {!modelLoading && modelBarItems.length === 0 && (
              <EmptyState title="No data yet" description="Token usage will appear once traces are captured." />
            )}
            {!modelLoading && modelBarItems.length > 0 && (
              <BarChart data={modelBarItems} width={820} height={220} color="#c9944a" />
            )}
          </div>
        </div>

        {/* Pass Rate Over Runs */}
        <div className="dash-card">
          <div className="card-header">
            <div className="min-w-0 flex-1">
              <h3>Pass Rate Over Runs</h3>
              <p>Latest evaluation suite</p>
            </div>
          </div>
          <div className="card-body">
            <div className="flex items-center gap-[18px] py-1 pb-4">
              <svg width="80" height="80" style={{ display: 'block', transform: 'rotate(-90deg)', flexShrink: 0 }}>
                <circle cx="40" cy="40" r="37" fill="none" stroke="#343438" strokeWidth="6" />
                <circle
                  cx="40" cy="40" r="37" fill="none" stroke="#3daa6f" strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={passRateRing.circumference}
                  strokeDashoffset={passRateRing.dashoffset}
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              </svg>
              <div>
                <div className="text-[30px] font-bold tracking-[-0.02em] text-success">
                  {Math.round((summary?.overallPassRate ?? 0) * 100)}<span className="text-[18px] text-muted">%</span>
                </div>
                <div className="text-xs text-muted">last run · +7pt vs prev</div>
              </div>
            </div>
            <AreaChart
              data={PASS_RATE_RAW}
              width={360}
              height={120}
              color="#3daa6f"
              gradientId="passGrad"
              showAxis={false}
            />
            <div className="flex justify-between text-[10px] text-muted mt-1 font-mono">
              <span>Run 1</span><span>Run 4</span><span>Run 8</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Traces + Agents */}
      <div className="fade-up grid gap-3" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)' }}>

        {/* Recent Traces */}
        <div className="dash-card">
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
        <div className="dash-card">
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
              <div key={agent.id} className="grid p-3 bg-card-2 rounded-xl items-center gap-3" style={{ gridTemplateColumns: '1fr auto', boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 1px 2px rgba(0,0,0,0.25)' }}>
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
              </div>
            ))}

            {/* Proposals teaser */}
            <div className="flex gap-[10px] items-start p-3 rounded-xl mt-1" style={{ background: 'linear-gradient(135deg, rgba(201,148,74,0.10), rgba(107,158,170,0.07))', boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 2px 4px rgba(0,0,0,0.2)' }}>
              <div className="w-7 h-7 rounded-[7px] shrink-0 flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, #c9944a, #6b9eaa)' }}>
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
