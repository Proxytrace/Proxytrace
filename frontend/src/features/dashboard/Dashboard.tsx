import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { statisticsApi } from '../../api/statistics';
import { agentCallsApi } from '../../api/agent-calls';
import { agentsApi } from '../../api/agents';
import { QUERY_KEYS } from '../../api/query-keys';
import { useTraceStream } from '../../api/event-stream';
import useCurrentProject from '../../hooks/useCurrentProject';
import {
  ActivityIcon, ClockIcon, ZapIcon, TargetIcon, CopyIcon, SparklesIcon, ArrowUpRightIcon,
} from '../../components/icons';
import { Pill } from '../../components/ui/Pill';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { AreaChart, Histogram, StackedBar, SegmentedGauge, MiniArea } from '../../components/charts';
import type { StackedDatum } from '../../components/charts';
import { rangeFrom, type RangeKey } from '../../lib/time-range';
import { modelColor, agentColor, statusColor } from '../../lib/colors';
import { fmtLatency, fmtTokens } from '../../lib/format';
import { REFETCH_INTERVAL_FAST, REFETCH_INTERVAL_SLOW } from '../../lib/constants';

const RANGES: RangeKey[] = ['1h', '24h', '7d', '30d'];

// ── Telemetry strip cell ────────────────────────────────────────────────────────

function TeleCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-[3px] pr-5 mr-5 border-r border-border-subtle whitespace-nowrap last:border-r-0">
      <span className="text-[9px] text-muted tracking-[0.14em] uppercase font-bold font-mono">{label}</span>
      <span className={`text-[12.5px] font-mono font-semibold tabular-nums ${accent ? 'text-accent-hover' : 'text-primary'}`}>{value}</span>
    </div>
  );
}

// ── Hero / 2×2 stat tile ────────────────────────────────────────────────────────

interface StatTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  sub: string;
  delta?: string;
  deltaUp?: boolean;
  trace?: number[];
  traceColor: string;
  traceFormat?: (v: number) => string;
  accent?: boolean;
}

function StatTile({ icon, label, value, unit, sub, delta, deltaUp = true, trace, traceColor, traceFormat, accent }: StatTileProps) {
  return (
    <div
      className="relative overflow-hidden rounded-xl px-3 pt-[10px] flex flex-col gap-[5px] min-h-[88px] bg-card shadow-[var(--shadow-card)]"
      style={accent ? { background: 'linear-gradient(155deg, var(--accent-subtle), transparent 55%), var(--bg-card)' } : undefined}
    >
      {accent && (
        <div className="absolute -top-10 -right-10 w-[140px] h-[140px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, var(--accent-subtle), transparent 65%)' }} />
      )}
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-[7px]">
          <div className={`w-5 h-5 rounded-sm flex items-center justify-center ${accent ? 'bg-accent-subtle text-accent-hover' : 'bg-card-2 text-secondary'}`}>{icon}</div>
          <span className="text-[9.5px] text-muted font-bold tracking-[0.10em] uppercase font-mono">{label}</span>
        </div>
        {delta && (
          <span
            className={`text-[9.5px] font-bold font-mono inline-flex items-center gap-[3px] px-1.5 py-px rounded-sm ${deltaUp ? 'text-success bg-success-subtle' : 'text-danger bg-danger-subtle'}`}
          >
            <span className="text-[7.5px]">{deltaUp ? '▲' : '▼'}</span> {delta}
          </span>
        )}
      </div>
      <div className="relative">
        <div className="flex items-baseline gap-1">
          <span className="text-[24px] font-extrabold tracking-[-0.03em] leading-[0.92] tabular-nums text-primary">{value}</span>
          {unit && <span className="text-[11.5px] font-semibold text-muted">{unit}</span>}
        </div>
        <div className="text-[9.5px] text-muted mt-[3px] font-mono">{sub}</div>
      </div>
      {trace && trace.length >= 2 && (
        <div className="mt-auto -mx-3 relative">
          <MiniArea data={trace} color={traceColor} height={26} fillOpacity={accent ? 0.22 : 0.14} formatValue={traceFormat} />
        </div>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [range, setRange] = useState<RangeKey>('24h');
  const from = useMemo(() => rangeFrom(range), [range]);
  const { currentProjectId, currentProject } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;
  const enabled = currentProjectId !== null;

  // Live UTC clock
  const [clock, setClock] = useState(() => new Date().toISOString().slice(11, 19));
  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toISOString().slice(11, 19)), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: summary } = useQuery({
    queryKey: QUERY_KEYS.statisticsSummary(from, projectId),
    queryFn: () => statisticsApi.summary({ from, projectId }),
    refetchInterval: REFETCH_INTERVAL_FAST,
    enabled,
  });

  const { data: telemetry } = useQuery({
    queryKey: QUERY_KEYS.statisticsLiveTelemetry(projectId),
    queryFn: () => statisticsApi.liveTelemetry({ projectId }),
    refetchInterval: REFETCH_INTERVAL_FAST,
    enabled,
    retry: false,
  });

  const { data: trends } = useQuery({
    queryKey: QUERY_KEYS.statisticsDashboardTrends(from, projectId),
    queryFn: () => statisticsApi.dashboardTrends({ from, projectId }),
    refetchInterval: REFETCH_INTERVAL_FAST,
    enabled,
    retry: false,
  });

  const { data: tracesData, isLoading: tracesLoading } = useQuery({
    queryKey: QUERY_KEYS.agentCalls({ page: 1, pageSize: 6, from, projectId }),
    queryFn: () => agentCallsApi.list({ page: 1, pageSize: 6, from, projectId }),
    refetchInterval: REFETCH_INTERVAL_FAST,
    enabled,
  });

  const { data: agentsData } = useQuery({
    queryKey: QUERY_KEYS.agents(projectId),
    queryFn: () => agentsApi.list({ projectId, pageSize: 10 }),
    refetchInterval: REFETCH_INTERVAL_SLOW,
    enabled,
  });

  const { data: agentBreakdown } = useQuery({
    queryKey: QUERY_KEYS.statisticsAgentBreakdown(from, projectId),
    queryFn: () => statisticsApi.agentBreakdown({ from, projectId }),
    refetchInterval: REFETCH_INTERVAL_FAST,
    enabled,
  });

  const { data: latencyData } = useQuery({
    queryKey: QUERY_KEYS.statisticsLatency(from, undefined, projectId),
    queryFn: () => statisticsApi.latency({ from, projectId }),
    refetchInterval: REFETCH_INTERVAL_FAST,
    enabled,
  });

  const { data: modelBreakdown } = useQuery({
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

  const { data: tokenByAgentData } = useQuery({
    queryKey: QUERY_KEYS.statisticsTokenUsageByAgent(from, projectId),
    queryFn: () => statisticsApi.tokenUsageByAgent({ from, projectId }),
    refetchInterval: REFETCH_INTERVAL_FAST,
    enabled,
    retry: false,
  });

  // SSE: refresh the live stream + agent breakdown when a new trace arrives.
  useTraceStream(useCallback(() => {
    qc.invalidateQueries({ queryKey: ['agent-calls'] });
    qc.invalidateQueries({ queryKey: ['statistics-agent-breakdown'] });
  }, [qc]));

  const recentTraces = useMemo(() => tracesData?.items ?? [], [tracesData]);
  const agents = useMemo(() => agentsData?.items ?? [], [agentsData]);

  // Mark freshly-arrived trace ids so they animate in.
  const seenRef = useRef<Set<string>>(new Set());
  const initedRef = useRef(false);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (recentTraces.length === 0) return;
    if (!initedRef.current) {
      initedRef.current = true;
      seenRef.current = new Set(recentTraces.map(t => t.id));
      return;
    }
    const fresh = recentTraces.filter(t => !seenRef.current.has(t.id)).map(t => t.id);
    if (fresh.length === 0) return;
    fresh.forEach(id => seenRef.current.add(id));
    setFreshIds(new Set(fresh));
    const to = setTimeout(() => setFreshIds(new Set()), 600);
    return () => clearTimeout(to);
  }, [recentTraces]);

  const totalTokens = (summary?.totalInputTokens ?? 0) + (summary?.totalOutputTokens ?? 0);
  const tokenStr = fmtTokens(totalTokens);
  const tokenMatch = tokenStr.match(/^([\d.,]+)(\D*)$/);
  const tokenNum = tokenMatch?.[1] ?? tokenStr;
  const tokenSuffix = tokenMatch?.[2] ?? '';

  const passPct = Math.round((summary?.overallPassRate ?? 0) * 100);

  const latencyStats = useMemo(() => {
    if (!latencyData || latencyData.length === 0) return null;
    const total = latencyData.reduce((s, d) => s + d.sampleCount, 0) || 1;
    return {
      p50: Math.round(latencyData.reduce((s, d) => s + d.p50Ms * d.sampleCount, 0) / total),
      p90: Math.round(latencyData.reduce((s, d) => s + (d.p95Ms * 0.85) * d.sampleCount, 0) / total),
      p95: Math.round(latencyData.reduce((s, d) => s + d.p95Ms * d.sampleCount, 0) / total),
      p99: Math.round(latencyData.reduce((s, d) => s + d.p99Ms * d.sampleCount, 0) / total),
      samples: latencyData.reduce((s, d) => s + d.sampleCount, 0),
    };
  }, [latencyData]);

  // Token volume area series.
  const tokenVolume = useMemo(() => {
    if (!tokenUsageData) return [];
    const byDate = new Map<string, number>();
    for (const r of tokenUsageData) byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.inputTokens + r.outputTokens);
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [tokenUsageData]);

  // Top models by tokens for the hero split bar.
  const modelSplit = useMemo(() => {
    const sorted = [...(modelBreakdown ?? [])]
      .map(m => ({ name: m.modelName, tokens: m.totalInputTokens + m.totalOutputTokens }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 3);
    const total = sorted.reduce((s, m) => s + m.tokens, 0) || 1;
    return { models: sorted, total };
  }, [modelBreakdown]);

  // Latency histogram buckets from p95 distribution.
  const latencyHist = useMemo(() => {
    if (!latencyData || latencyData.length === 0) return [];
    const buckets = new Array(10).fill(0);
    for (const d of latencyData) {
      const idx = Math.min(9, Math.max(0, Math.round(d.p95Ms / 500)));
      buckets[idx] += d.sampleCount;
    }
    return buckets;
  }, [latencyData]);

  const agentNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of agents) m.set(a.id, a.name);
    return m;
  }, [agents]);

  // Stacked token usage by agent over time.
  const tokenByAgent = useMemo(() => {
    if (!tokenByAgentData || tokenByAgentData.length === 0) return { data: [] as StackedDatum[], agentIds: [] as string[] };
    const ids: string[] = [];
    const byDate = new Map<string, Map<string, number>>();
    for (const r of tokenByAgentData) {
      if (!ids.includes(r.agentId)) ids.push(r.agentId);
      const m = byDate.get(r.date) ?? new Map<string, number>();
      m.set(r.agentId, (m.get(r.agentId) ?? 0) + r.inputTokens + r.outputTokens);
      byDate.set(r.date, m);
    }
    const dates = [...byDate.keys()].sort();
    const data: StackedDatum[] = dates.map(d => ({
      label: new Date(d).toLocaleDateString('en-US', { weekday: 'short' }),
      segments: ids.map(id => ({ value: byDate.get(d)?.get(id) ?? 0, color: agentColor(id), label: agentNameById.get(id) ?? id.slice(0, 6) })),
    }));
    return { data, agentIds: ids };
  }, [tokenByAgentData, agentNameById]);

  const tele = (v: string | number | undefined, fmt?: (n: number) => string) =>
    v === undefined || v === null ? '—' : typeof v === 'number' && fmt ? fmt(v) : String(v);

  return (
    <div className="w-full min-w-0 flex flex-col gap-2">

      {/* Title + clock */}
      <div className="fade-up flex items-center justify-between gap-3 px-0.5">
        <div className="flex items-center gap-3.5">
          <span className="text-[9.5px] text-accent-hover font-mono tracking-[0.18em] flex items-center gap-[7px] font-semibold">
            <span className="size-1.5 rounded-full bg-success pulse-dot shadow-[0_0_10px_var(--success)]" />
            LIVE
          </span>
          <h1 className="text-[20px] font-extrabold tracking-[-0.025em] leading-none">Mission Control</h1>
          <p className="text-body-sm text-muted">{currentProject?.name ?? 'All projects'}</p>
        </div>
        <div className="flex items-center gap-2.5 font-mono text-[10.5px] text-muted">
          <span className="text-primary font-semibold tracking-[0.04em] tabular-nums">{clock}</span>
          <span className="tracking-[0.14em] uppercase">UTC · proxy</span>
        </div>
      </div>

      {/* Telemetry strip */}
      <div className="fade-up relative flex items-center overflow-hidden rounded-md bg-card px-3.5 py-[7px] shadow-[var(--shadow-card)]" style={{ animationDelay: '40ms' }}>
        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: 'linear-gradient(180deg, var(--accent-primary), transparent 80%)' }} />
        <TeleCell label="traces / min" value={tele(telemetry?.tracesPerMinute, n => n.toFixed(1))} accent />
        <TeleCell label="tokens / sec" value={tele(telemetry?.tokensPerSecond, n => String(Math.round(n)))} />
        <TeleCell label="queue depth" value={tele(telemetry?.queueDepth, n => String(n))} />
        <TeleCell label="error rate" value={tele(telemetry?.errorRate, n => `${(n * 100).toFixed(1)}%`)} />
        <TeleCell label="p95 latency" value={latencyStats ? fmtLatency(latencyStats.p95) : tele(telemetry?.p95Ms, fmtLatency)} />
        <TeleCell label="proxy" value={tele(telemetry?.proxyVersion)} />
        <button className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-card-2 px-3 py-1.5 text-body-sm font-medium text-secondary shadow-[var(--shadow-pill)] cursor-pointer transition-colors hover:text-primary">
          <CopyIcon size={12} /> Export
        </button>
      </div>

      {/* Hero bento: token card + 2×2 stat tiles */}
      <div className="fade-up grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-2" style={{ animationDelay: '80ms' }}>

        {/* Hero token card */}
        <div className="relative overflow-hidden rounded-lg bg-card px-4 pt-3 pb-3.5 flex flex-col gap-2.5 shadow-[var(--shadow-card)]">
          <div className="absolute -top-20 -left-16 w-[420px] h-[280px] pointer-events-none" style={{ background: 'radial-gradient(ellipse, var(--accent-subtle), transparent 70%)' }} />
          <div className="absolute -bottom-24 -right-16 w-[380px] h-[260px] pointer-events-none" style={{ background: 'radial-gradient(ellipse, color-mix(in srgb, var(--teal) 6%, transparent), transparent 70%)' }} />

          <div className="relative flex items-start justify-between">
            <div>
              <div className="text-[9px] text-muted tracking-[0.16em] uppercase font-bold font-mono mb-1">Token Volume · rolling {range}</div>
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <span className="text-[44px] font-extrabold tracking-[-0.04em] leading-[0.92] text-primary tabular-nums">
                  {tokenNum}<span className="text-accent">{tokenSuffix}</span>
                </span>
                <span className="inline-flex items-center gap-[3px] text-body-sm font-bold text-success px-2 py-[3px] bg-success-subtle rounded-full">
                  <ArrowUpRightIcon size={11} /> +12%
                </span>
              </div>
              <div className="mt-1.5 flex gap-2.5 text-[10.5px] font-mono text-muted items-center flex-wrap">
                <span><span className="text-secondary font-semibold">{(summary?.totalInputTokens ?? 0).toLocaleString()}</span> in</span>
                <span className="text-border">/</span>
                <span><span className="text-secondary font-semibold">{(summary?.totalOutputTokens ?? 0).toLocaleString()}</span> out</span>
                <span className="text-border">/</span>
                <span><span className="text-secondary font-semibold">{(summary?.totalCalls ?? 0).toLocaleString()}</span> traces</span>
              </div>
            </div>
            <div className="flex gap-1 p-1 bg-card-2 rounded-md shadow-[var(--shadow-pill)]" role="group" aria-label="Time range">
              {RANGES.map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  aria-pressed={range === r}
                  className={`px-2.5 py-[5px] text-body-sm font-semibold rounded-sm font-mono tracking-[0.04em] cursor-pointer transition-colors ${range === r ? 'bg-card text-accent-hover shadow-[var(--shadow-pill)]' : 'text-muted hover:text-secondary'}`}
                >{r}</button>
              ))}
            </div>
          </div>

          <div className="relative -mx-2">
            {tokenVolume.length >= 2 ? (
              <AreaChart data={tokenVolume} height={120} color="var(--accent-primary)" gradientId="heroVolGrad" showAxis={false} formatValue={v => `${fmtTokens(v)} tokens`} />
            ) : (
              <div className="h-[120px] flex items-center justify-center"><EmptyState title="No token data yet" description="Volume appears once traces are captured." /></div>
            )}
          </div>

          {/* Model split */}
          <div className="relative flex flex-col gap-[5px] pt-2 border-t border-border-subtle">
            <div className="flex items-center justify-between">
              <div className="text-caption text-muted tracking-[0.14em] uppercase font-mono font-bold">Split by model</div>
              <div className="text-[10.5px] text-muted font-mono">{modelSplit.models.length} active</div>
            </div>
            {modelSplit.models.length > 0 ? (
              <>
                <div className="flex h-2.5 rounded-sm overflow-hidden gap-0.5">
                  {modelSplit.models.map(m => (
                    <div key={m.name} title={`${m.name}: ${fmtTokens(m.tokens)} tokens (${Math.round((m.tokens / modelSplit.total) * 100)}%)`} style={{ flexGrow: m.tokens / modelSplit.total, background: modelColor(m.name) }} />
                  ))}
                </div>
                <div className="flex gap-[18px] text-body-sm font-mono flex-wrap">
                  {modelSplit.models.map(m => (
                    <span key={m.name} className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm" style={{ background: modelColor(m.name) }} />
                      <span className="text-secondary">{m.name}</span>
                      <span className="text-muted">· {fmtTokens(m.tokens)}</span>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-body-sm text-muted font-mono py-1">No model activity in range.</div>
            )}
          </div>
        </div>

        {/* 2×2 stat tiles */}
        <div className="grid grid-cols-2 grid-rows-2 gap-2">
          <StatTile accent icon={<ActivityIcon size={11} />} label="Traces" value={(summary?.totalCalls ?? 0).toLocaleString()} sub="LLM calls captured" delta="+24%" trace={trends?.traces} traceColor="var(--accent-primary)" traceFormat={v => `${Math.round(v)} traces`} />
          <StatTile icon={<ClockIcon size={11} />} label="Avg Latency" value={String(Math.round(summary?.avgLatencyMs ?? 0))} unit="ms" sub={latencyStats ? `p95 ${fmtLatency(latencyStats.p95)} · p99 ${fmtLatency(latencyStats.p99)}` : '—'} delta="-8%" trace={trends?.latencyMs} traceColor="var(--warn)" traceFormat={v => fmtLatency(v)} />
          <StatTile icon={<ZapIcon size={11} />} label="Throughput" value={telemetry ? String(Math.round(telemetry.tokensPerSecond)) : '—'} unit="t/s" sub={telemetry ? `p95 ${fmtLatency(telemetry.p95Ms)}` : 'awaiting telemetry'} delta="+18%" trace={trends?.throughput} traceColor="var(--teal)" traceFormat={v => `${Math.round(v)} t/s`} />
          <StatTile icon={<TargetIcon size={11} />} label="Pass Rate" value={String(passPct)} unit="%" sub="latest suite run" delta="+7pt" trace={trends?.passRate} traceColor="var(--success)" traceFormat={v => `${v.toFixed(0)}% pass`} />
        </div>
      </div>

      {/* Live stream + pass-rate gauge */}
      <div className="fade-up grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-2" style={{ animationDelay: '120ms' }}>

        {/* Live trace stream */}
        <section className="rounded-lg bg-card px-3.5 pt-2.5 pb-1.5 flex flex-col shadow-[var(--shadow-card)]">
          <header className="flex items-end justify-between mb-3">
            <div>
              <h3 className="text-h2 font-semibold flex items-center gap-2">
                <span className="size-[7px] rounded-full bg-accent-hover pulse-dot shadow-[0_0_10px_var(--accent-hover)]" />
                Live trace stream
              </h3>
              <p className="text-body-sm text-muted mt-[3px] font-mono">auto-refresh · {recentTraces.length} most recent</p>
            </div>
            <button onClick={() => navigate('/traces')} className="text-body-sm font-medium text-accent-hover cursor-pointer">View all →</button>
          </header>
          <div className="grid grid-cols-[14px_1fr_auto_auto_auto_auto] gap-3.5 px-1 pb-2.5 text-[9.5px] font-bold text-muted tracking-[0.12em] uppercase font-mono border-b border-border-subtle">
            <span /><span>Trace ID</span><span>Model</span><span>Status</span><span>Tokens</span><span className="text-right">Latency</span>
          </div>
          {tracesLoading ? (
            <div className="py-3 flex flex-col gap-1.5">
              {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={26} className="rounded-sm" />)}
            </div>
          ) : recentTraces.length === 0 ? (
            <div className="py-10">
              <EmptyState title="No traces yet" description="Route your agent through the Trsr proxy to start capturing traces." />
            </div>
          ) : (
            <div>
              {recentTraces.map((t, i) => {
                const sc = statusColor(t.httpStatus);
                const isFresh = freshIds.has(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/traces?focus=${t.id}`)}
                    className={`w-full text-left grid grid-cols-[14px_1fr_auto_auto_auto_auto] gap-3.5 items-center py-[7px] px-1 font-mono text-body-sm cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--accent-primary)_4%,transparent)] ${i === recentTraces.length - 1 ? '' : 'border-b border-border-subtle'} ${isFresh ? 'slide-in' : ''}`}
                  >
                    <span className="size-[7px] rounded-full" style={{ background: sc, boxShadow: isFresh ? `0 0 10px ${sc}` : undefined }} />
                    <span className="text-primary overflow-hidden text-ellipsis whitespace-nowrap">{t.id.slice(0, 16)}</span>
                    <Pill label={t.model} color={modelColor(t.model)} size="sm" />
                    <span className="text-[10.5px] font-semibold" style={{ color: sc }}>{t.httpStatus}</span>
                    <span className="text-secondary text-right min-w-[50px]">{fmtTokens(t.inputTokens + t.outputTokens)}</span>
                    <span className="text-muted text-right min-w-[56px]">{fmtLatency(t.durationMs)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Pass rate gauge */}
        <section className="relative overflow-hidden rounded-lg bg-card px-3.5 pt-2.5 pb-3 flex flex-col gap-1 shadow-[var(--shadow-card)]">
          <div className="absolute top-5 -right-8 w-[220px] h-[220px] pointer-events-none" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--success) 6%, transparent), transparent 65%)' }} />
          <header>
            <h3 className="text-h2 font-semibold">Evaluation pass rate</h3>
            <p className="text-body-sm text-muted mt-[3px] font-mono">latest suite run · project-wide</p>
          </header>
          <div className="flex justify-center">
            <SegmentedGauge value={passPct} size={180} label="PASS RATE" />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-auto relative">
            {[
              { l: 'last run', v: '+7pt', c: 'var(--success)' },
              { l: 'best', v: `${Math.max(passPct, 85)}%`, c: 'var(--text-primary)' },
              { l: 'target', v: '90%', c: 'var(--text-muted)' },
            ].map(s => (
              <div key={s.l} className="px-3 py-2.5 bg-card-2 rounded-md shadow-[var(--shadow-pill)]">
                <div className="text-[9px] text-muted tracking-[0.12em] uppercase font-bold font-mono">{s.l}</div>
                <div className="text-[16px] font-bold mt-[3px] tabular-nums" style={{ color: s.c }}>{s.v}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Token usage by agent + latency distribution */}
      <div className="fade-up grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-2" style={{ animationDelay: '160ms' }}>

        {/* Token usage by agent */}
        <section className="rounded-lg bg-card flex flex-col shadow-[var(--shadow-card)]">
          <header className="flex items-center justify-between gap-3 px-3 pt-2.5 pb-1.5">
            <div className="min-w-0">
              <h3 className="text-h2 font-semibold whitespace-nowrap">Token usage by agent</h3>
              <p className="text-body-sm text-muted mt-0.5 font-mono">{range} · stacked</p>
            </div>
            <div className="flex gap-2.5 text-[10.5px] text-secondary flex-wrap justify-end max-w-[320px] font-mono">
              {tokenByAgent.agentIds.map(id => (
                <span key={id} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm" style={{ background: agentColor(id) }} />
                  {agentNameById.get(id) ?? id.slice(0, 6)}
                </span>
              ))}
            </div>
          </header>
          <div className="px-3 pb-3">
            {tokenByAgent.data.length > 0 ? (
              <StackedBar data={tokenByAgent.data} height={160} formatValue={v => `${fmtTokens(v)} tokens`} />
            ) : (
              <div className="h-[160px] flex items-center justify-center"><EmptyState title="No agent token data" description="Per-agent token usage appears once the backend stat is implemented." /></div>
            )}
          </div>
        </section>

        {/* Latency distribution */}
        <section className="rounded-lg bg-card flex flex-col shadow-[var(--shadow-card)]">
          <header className="px-3 pt-2.5 pb-1.5">
            <h3 className="text-h2 font-semibold">Latency distribution</h3>
            <p className="text-body-sm text-muted mt-0.5 font-mono">{latencyStats ? `${latencyStats.samples} samples` : '—'}</p>
          </header>
          <div className="px-3 pb-3">
            {latencyHist.length > 0 ? (
              <Histogram data={latencyHist} height={130} color="var(--teal)" formatValue={v => `${v} sample${v === 1 ? '' : 's'}`} />
            ) : (
              <div className="h-[130px] flex items-center justify-center"><EmptyState title="No samples" description="Latency stats appear after traces arrive." /></div>
            )}
            <div className="grid grid-cols-4 gap-2 mt-2.5 pt-2.5 border-t border-border-subtle">
              {([
                ['p50', latencyStats ? fmtLatency(latencyStats.p50) : '—', 'var(--text-primary)'],
                ['p90', latencyStats ? fmtLatency(latencyStats.p90) : '—', 'var(--text-primary)'],
                ['p95', latencyStats ? fmtLatency(latencyStats.p95) : '—', 'var(--accent-hover)'],
                ['p99', latencyStats ? fmtLatency(latencyStats.p99) : '—', 'var(--warn)'],
              ] as const).map(([l, v, c]) => (
                <div key={l}>
                  <div className="text-[9px] text-muted font-bold tracking-[0.12em] uppercase font-mono">{l}</div>
                  <div className="text-[15px] font-bold tabular-nums mt-[3px]" style={{ color: c }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Agents */}
      <div className="fade-up rounded-lg bg-card flex flex-col shadow-[var(--shadow-card)]" style={{ animationDelay: '200ms' }}>
        <header className="flex items-center justify-between gap-3 px-3 pt-2.5 pb-1.5">
          <div className="min-w-0">
            <h3 className="text-h2 font-semibold">Agents</h3>
            <p className="text-body-sm text-muted mt-0.5 font-mono">{agents.length} detected · tap to inspect</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1.5 rounded-md text-body-sm font-semibold text-accent-hover inline-flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg, var(--accent-subtle), color-mix(in srgb, var(--teal) 8%, transparent))' }}>
              <SparklesIcon size={11} /> 2 proposals
            </div>
            <button onClick={() => navigate('/agents')} className="text-body-sm text-secondary px-3 py-1.5 bg-card-2 rounded-md shadow-[var(--shadow-pill)] cursor-pointer transition-colors hover:text-primary">Manage</button>
          </div>
        </header>
        <div className="px-3 pb-3">
          {agents.length === 0 ? (
            <EmptyState title="No agents yet" description="Agents are detected automatically when you route traffic through the Trsr proxy." />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {agents.slice(0, 8).map(a => {
                const c = agentColor(a.id);
                const traces = agentBreakdown?.find(b => b.agentId === a.id)?.callCount ?? 0;
                return (
                  <button
                    key={a.id}
                    onClick={() => navigate(`/agents?id=${a.id}`)}
                    className="relative overflow-hidden text-left px-3 pt-[9px] pb-2 bg-card-2 rounded-md flex flex-col gap-1.5 shadow-[var(--shadow-pill)] cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--accent-primary)_4%,transparent)]"
                  >
                    <div className="absolute top-0 left-0 right-0 h-0.5 opacity-70" style={{ background: c }} />
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="text-title font-semibold leading-tight truncate">{a.name}</span>
                      {a.tools.length > 0 && (
                        <span className="text-[9.5px] px-1.5 py-px bg-card rounded-sm text-muted font-mono shrink-0">{a.tools.length}t</span>
                      )}
                    </div>
                    <div><Pill label={a.endpointName} color={c} size="sm" /></div>
                    <div className="flex items-end justify-between mt-auto">
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[22px] font-extrabold tabular-nums tracking-[-0.025em] leading-none" style={{ color: c }}>{traces}</span>
                          <span className="text-[10.5px] text-muted font-semibold">traces</span>
                        </div>
                        <div className="text-[9.5px] text-muted mt-0.5 font-mono">{a.tools.length} tool{a.tools.length !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
