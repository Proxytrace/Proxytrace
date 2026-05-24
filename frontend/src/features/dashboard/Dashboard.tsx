import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTraceStream } from '../../api/event-stream';
import { QUERY_KEYS } from '../../api/query-keys';
import useCurrentProject from '../../hooks/useCurrentProject';
import { rangeFrom, type RangeKey } from '../../lib/time-range';
import {
  computeLatencyStats,
  computeTokenVolume,
  computeModelSplit,
  computeLatencyHist,
  computeTokenByAgent,
  buildAgentNameMap,
} from './dashboardMeta';
import {
  useDashboardSummary,
  useLiveTelemetry,
  useDashboardTrends,
  useRecentTraces,
  useDashboardAgents,
  useAgentBreakdown,
  useLatencyStats,
  useModelBreakdown,
  useTokenUsage,
  useTokenUsageByAgent,
} from './hooks/useDashboardQueries';
import { useLiveClock } from './hooks/useLiveClock';
import { useFreshTraces } from './hooks/useFreshTraces';
import { TelemetryStrip } from './components/TelemetryStrip';
import { HeroTokenCard } from './components/HeroTokenCard';
import { StatTileGrid } from './components/StatTileGrid';
import { LiveTraceStream } from './components/LiveTraceStream';
import { PassRateGauge } from './components/PassRateGauge';
import { TokenByAgentSection } from './components/TokenByAgentSection';
import { LatencySection } from './components/LatencySection';
import { AgentsSection } from './components/AgentsSection';

export default function Dashboard() {
  const qc = useQueryClient();
  const [range, setRange] = useState<RangeKey>('24h');
  const from = rangeFrom(range);
  const { currentProjectId, currentProject } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;
  const enabled = currentProjectId !== null;

  const clock = useLiveClock();

  // ── Data hooks ──────────────────────────────────────────────────────────────

  const queryOpts = { from, projectId, enabled };

  const { data: summary } = useDashboardSummary(queryOpts);
  const { data: telemetry } = useLiveTelemetry({ projectId, enabled });
  const { data: trends } = useDashboardTrends(queryOpts);
  const { data: tracesData, isLoading: tracesLoading } = useRecentTraces(queryOpts);
  const { data: agentsData } = useDashboardAgents({ projectId, enabled });
  const { data: agentBreakdown } = useAgentBreakdown(queryOpts);
  const { data: latencyData } = useLatencyStats(queryOpts);
  const { data: modelBreakdown } = useModelBreakdown(queryOpts);
  const { data: tokenUsageData } = useTokenUsage(queryOpts);
  const { data: tokenByAgentData } = useTokenUsageByAgent(queryOpts);

  // ── SSE: invalidate on new traces ───────────────────────────────────────────

  useTraceStream(() => {
    qc.invalidateQueries({ queryKey: QUERY_KEYS.agentCallsRoot });
    qc.invalidateQueries({ queryKey: QUERY_KEYS.statisticsAgentBreakdownRoot });
  });

  // ── Derived data ────────────────────────────────────────────────────────────

  const recentTraces = tracesData?.items ?? [];
  const agents = agentsData?.items ?? [];
  const freshIds = useFreshTraces(recentTraces);

  const latencyStats = computeLatencyStats(latencyData ?? []);
  const tokenVolume = computeTokenVolume(tokenUsageData ?? []);
  const modelSplit = computeModelSplit(modelBreakdown ?? []);
  const latencyHist = computeLatencyHist(latencyData ?? []);
  const agentNameById = buildAgentNameMap(agents);
  const tokenByAgent = computeTokenByAgent(tokenByAgentData ?? [], agentNameById);

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
      <TelemetryStrip telemetry={telemetry} latencyStats={latencyStats} />

      {/* Hero bento: token card + 2×2 stat tiles */}
      <div
        className="fade-up grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-2"
        style={{ animationDelay: '80ms' }}
      >
        <HeroTokenCard
          summary={summary}
          tokenVolume={tokenVolume}
          modelSplit={modelSplit}
          range={range}
          onRangeChange={setRange}
        />
        <StatTileGrid
          summary={summary}
          telemetry={telemetry}
          trends={trends}
          latencyStats={latencyStats}
        />
      </div>

      {/* Live stream + pass-rate gauge */}
      <div
        className="fade-up grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-2"
        style={{ animationDelay: '120ms' }}
      >
        <LiveTraceStream traces={recentTraces} isLoading={tracesLoading} freshIds={freshIds} />
        <PassRateGauge summary={summary} />
      </div>

      {/* Token usage by agent + latency distribution */}
      <div
        className="fade-up grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-2"
        style={{ animationDelay: '160ms' }}
      >
        <TokenByAgentSection tokenByAgent={tokenByAgent} agentNameById={agentNameById} range={range} />
        <LatencySection latencyHist={latencyHist} latencyStats={latencyStats} />
      </div>

      {/* Agents */}
      <AgentsSection agents={agents} agentBreakdown={agentBreakdown} />

    </div>
  );
}
