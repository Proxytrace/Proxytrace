import { useMemo } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQueryClient } from '@tanstack/react-query';
import { useTraceStream } from '../../api/event-stream';
import { QUERY_KEYS } from '../../api/query-keys';
import useCurrentProject from '../../hooks/useCurrentProject';
import { bucketFor, rangeFromOpt, RANGE_KEYS, type RangeKey } from '../../lib/time-range';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import {
  computeLatencyStats,
  computeTokenSeries,
  computeModelSplit,
  computeLatencyHist,
  computeTokenAgentShare,
} from './dashboardMeta';
import { useDashboardView } from './hooks/useDashboardQueries';
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
  const { t } = useLingui();
  const qc = useQueryClient();
  // Range selector persists across refresh / navigation. Defaults to the all-time bucket
  // until the user picks a window.
  const [storedRange, setRange] = useLocalStorageState<RangeKey>('dashboard.range', 'all');
  // Guard against a stale/garbage stored value — only accept a known key.
  const range = RANGE_KEYS.includes(storedRange) ? storedRange : 'all';
  // Memoize so `from` is stable across renders; recomputing `new Date()` each
  // render would churn every queryKey below and cause an infinite refetch loop.
  // `undefined` for the all-time bucket (no `from` filter).
  const from = useMemo(() => rangeFromOpt(range), [range]);
  const { currentProjectId, currentProject } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;
  const enabled = currentProjectId !== null;

  const clock = useLiveClock();

  // ── Data hooks ──────────────────────────────────────────────────────────────

  const queryOpts = { from, projectId, enabled };

  const { data: dashboard, isLoading: dashboardLoading } = useDashboardView(queryOpts);

  // ── SSE: invalidate on new traces ───────────────────────────────────────────

  useTraceStream(() => {
    qc.invalidateQueries({ queryKey: QUERY_KEYS.statisticsDashboard(from, projectId) });
  });

  // ── Derived data ────────────────────────────────────────────────────────────

  const summary = dashboard?.summary;
  const telemetry = dashboard?.liveTelemetry;
  const trends = dashboard?.trends;
  const agentBreakdown = dashboard?.agentBreakdown;
  const recentTraces = dashboard?.recentTraces ?? [];
  const agents = dashboard?.agents ?? [];
  const freshIds = useFreshTraces(recentTraces);

  const latencyStats = computeLatencyStats(dashboard?.latency ?? []);
  const tokenBucket = dashboard?.tokenBucket ?? bucketFor(range);
  const tokenSeries = computeTokenSeries(dashboard?.tokenUsage ?? [], range, tokenBucket);
  const modelSplit = computeModelSplit(dashboard?.modelBreakdown ?? []);
  const latencyHist = computeLatencyHist(dashboard?.latency ?? []);
  const tokenAgentShare = computeTokenAgentShare(dashboard?.tokenUsageByAgent ?? [], agents);

  return (
    <div className="w-full min-w-0 flex flex-col gap-2">

      {/* Title + clock */}
      <div className="fade-up flex items-center justify-between gap-3 px-0.5">
        <div className="flex items-center gap-3.5">
          <span className="text-[9.5px] text-accent-hover font-mono tracking-[0.18em] flex items-center gap-[7px] font-semibold">
            <span className="size-1.5 rounded-full bg-success pulse-dot shadow-[0_0_10px_var(--success)]" />
            <Trans>LIVE</Trans>
          </span>
          <h1 className="text-[20px] font-extrabold tracking-[-0.025em] leading-none"><Trans>Mission Control</Trans></h1>
          <p className="text-body-sm text-muted">{currentProject?.name ?? t`All projects`}</p>
        </div>
        <div className="flex items-center gap-2.5 font-mono text-[10.5px] text-muted">
          <span className="text-primary font-semibold tracking-[0.04em] tabular-nums">{clock}</span>
          <span className="tracking-[0.14em] uppercase"><Trans>UTC · proxy</Trans></span>
        </div>
      </div>

      {/* Telemetry strip */}
      <TelemetryStrip telemetry={telemetry} latencyStats={latencyStats} />

      {/* Hero bento: token card + 2×2 stat tiles */}
      <div
        className="fade-up grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-2 [animation-delay:80ms]"
      >
        <HeroTokenCard
          summary={summary}
          tokenVolume={tokenSeries.values}
          tokenBuckets={tokenSeries.buckets}
          bucket={tokenBucket}
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
        className="fade-up grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-2 [animation-delay:120ms]"
      >
        <LiveTraceStream traces={recentTraces} isLoading={dashboardLoading} freshIds={freshIds} />
        <PassRateGauge summary={summary} />
      </div>

      {/* Token usage by agent + latency distribution */}
      <div
        className="fade-up grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-2 [animation-delay:160ms]"
      >
        <TokenByAgentSection share={tokenAgentShare} range={range} />
        <LatencySection latencyHist={latencyHist} latencyStats={latencyStats} />
      </div>

      {/* Agents */}
      <AgentsSection agents={agents} agentBreakdown={agentBreakdown} />

    </div>
  );
}
