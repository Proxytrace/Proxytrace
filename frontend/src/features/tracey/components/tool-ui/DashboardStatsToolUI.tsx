import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { GridIcon } from '../../../../components/icons';
import { fmtLatency, fmtPct, fmtTokens } from '../../../../lib/format';
import { passRateTone } from '../../../../lib/runResults';
import { ToolUIFrame } from './ToolUIFrame';
import { StatGrid, StatGridSkeleton } from './StatGrid';
import { CardOpenLink } from './CardOpenLink';
import { useArtifactResult } from '../../useArtifact';

/** Inline renderer for the `get_dashboard_stats` tool result. */
export const DashboardStatsToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const { t } = useLingui();
  // eslint-disable-next-line lingui/no-unlocalized-strings -- artifact kind token, not UI copy
  const { state, data } = useArtifactResult('dashboard-stats', result, status, isError);
  if (state !== 'ready' || !data) {
    return (
      <ToolUIFrame
        state={state}
        pendingLabel={t`Loading dashboard…`}
        pendingSkeleton={<StatGridSkeleton count={5} />}
        testId="tracey-dashboard-stats"
      />
    );
  }
  const { summary, liveTelemetry: live } = data;
  return (
    <ToolUIFrame
      state="ready"
      title={t`Dashboard`}
      icon={<GridIcon size={14} />}
      cornerAccessory={<CardOpenLink to="/dashboard" />}
      testId="tracey-dashboard-stats"
    >
      <StatGrid
        items={[
          { label: t`Calls`, value: fmtTokens(summary.totalCalls) },
          { label: t`Tokens in`, value: fmtTokens(summary.totalInputTokens) },
          { label: t`Tokens out`, value: fmtTokens(summary.totalOutputTokens) },
          { label: t`Avg latency`, value: fmtLatency(summary.avgLatencyMs) },
          {
            label: t`Pass rate`,
            value: summary.overallPassRate != null ? fmtPct(summary.overallPassRate) : '—',
            tone: passRateTone(summary.overallPassRate != null ? summary.overallPassRate * 100 : null),
          },
        ]}
      />
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-hairline pt-2.5 text-body-sm">
        <span className="inline-flex items-center gap-1.5 font-medium text-secondary">
          <span aria-hidden className="pulse-dot size-1.5 rounded-full bg-success" />
          <Trans>Live</Trans>
        </span>
        <span className="font-mono tabular-nums text-muted" title={t`Traces per minute`}>
          <Trans>{live.tracesPerMinute.toFixed(1)}/min</Trans>
        </span>
        <span className="font-mono tabular-nums text-muted" title={t`95th percentile latency`}>
          <Trans>{fmtLatency(live.p95Ms)} p95</Trans>
        </span>
        <span className="font-mono tabular-nums text-muted" title={t`Error rate`}>
          <Trans>{fmtPct(live.errorRate)} errors</Trans>
        </span>
      </div>
    </ToolUIFrame>
  );
};
