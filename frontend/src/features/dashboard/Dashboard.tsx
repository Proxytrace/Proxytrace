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
import { usePulse } from './hooks/usePulse';
import { PulseBand } from './components/PulseBand';
import { HeroTokenCard } from './components/HeroTokenCard';
import { StatTileGrid } from './components/StatTileGrid';
import { LiveTraceStream } from './components/LiveTraceStream';
import { PassRateGauge } from './components/PassRateGauge';
import { TokenByAgentSection } from './components/TokenByAgentSection';
import { LatencySection } from './components/LatencySection';
import { AgentsSection } from './components/AgentsSection';
import { AskTraceyButton } from '../../components/tracey/AskTraceyButton';
import { projectHealthPrompt } from '../../components/tracey/askTraceyPrompts';

export default function Dashboard() {
  const { t } = useLingui();
  const qc = useQueryClient();
  // Range selector persists across refresh / navigation. Defaults to the all-time bucket
  // until the user picks a window.
  // eslint-disable-next-line lingui/no-unlocalized-strings -- RangeKey enum token, not UI copy
  const [storedRange, setRange] = useLocalStorageState<RangeKey>('dashboard.range', 'all');
  // Guard against a stale/garbage stored value — only accept a known key.
  // eslint-disable-next-line lingui/no-unlocalized-strings -- RangeKey enum token, not UI copy
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
  const { pulse, lastBeat } = usePulse(dashboard?.pulse, projectId);

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
          <span className="text-caption text-accent-hover font-mono tracking-[0.18em] flex items-center gap-1.5 font-semibold">
            <span className="size-1.5 rounded-full bg-success pulse-dot shadow-[0_0_10px_var(--success)]" />
            <Trans>LIVE</Trans>
          </span>
          {/* display-tier: intentional, outside type scale */}
          <h1 className="text-[20px] font-extrabold tracking-[-0.025em] leading-none"><Trans>Mission Control</Trans></h1>
          <p className="text-body-sm text-muted">{currentProject?.name ?? t`All projects`}</p>
        </div>
        <div className="flex items-center gap-3">
          <AskTraceyButton data-testid="ask-tracey-btn-dashboard" prompt={projectHealthPrompt()} />
          <div className="flex items-center gap-2.5 font-mono text-caption text-muted">
            <span className="text-primary font-semibold tracking-[0.04em] tabular-nums">{clock}</span>
            <span className="tracking-[0.14em] uppercase"><Trans>UTC · proxy</Trans></span>
          </div>
        </div>
      </div>

      {/* ① Pulse band — the 5-second hook */}
      <div className="fade-up [animation-delay:40ms]">
        <PulseBand pulse={pulse} lastBeat={lastBeat} telemetry={telemetry} />
      </div>

      {/* ② Live theater + ③ token hero */}
      <div className="fade-up grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1.15fr)] gap-2 [animation-delay:80ms]">
        <LiveTraceStream traces={recentTraces} isLoading={dashboardLoading} freshIds={freshIds} />
        <HeroTokenCard
          summary={summary}
          tokenVolume={tokenSeries.values}
          tokenBuckets={tokenSeries.buckets}
          bucket={tokenBucket}
          modelSplit={modelSplit}
          range={range}
          onRangeChange={setRange}
          isLoading={dashboardLoading}
        />
      </div>

      {/* ④ Scale + quality band */}
      <div className="fade-up grid grid-cols-1 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)] gap-2 [animation-delay:120ms]">
        <StatTileGrid
          summary={summary}
          telemetry={telemetry}
          trends={trends}
          latencyStats={latencyStats}
        />
        <PassRateGauge summary={summary} />
      </div>

      <div className="fade-up grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-2 [animation-delay:160ms]">
        <TokenByAgentSection share={tokenAgentShare} range={range} isLoading={dashboardLoading} />
        <LatencySection latencyHist={latencyHist} latencyStats={latencyStats} isLoading={dashboardLoading} />
      </div>

      {/* ⑤ Agents */}
      <AgentsSection agents={agents} agentBreakdown={agentBreakdown} />

    </div>
  );
}
