import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { GridIcon } from '../../../../components/icons';
import { fmtLatency, fmtPct, fmtTokens } from '../../../../lib/format';
import type { DashboardViewDto } from '../../../../api/models';
import { ToolUIFrame } from './ToolUIFrame';
import { StatGrid } from './StatGrid';
import { CardOpenLink } from './CardOpenLink';
import { toolUiState } from './tool-ui-state';

/** Inline renderer for the `get_dashboard_stats` tool result. */
export const DashboardStatsToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const state = toolUiState(status, isError, result != null);
  if (state !== 'ready') {
    return <ToolUIFrame state={state} pendingLabel="Loading dashboard…" testId="tracey-dashboard-stats" />;
  }
  const { summary, liveTelemetry: live } = result as DashboardViewDto;
  return (
    <ToolUIFrame
      state="ready"
      title="Dashboard"
      icon={<GridIcon size={14} />}
      cornerAccessory={<CardOpenLink to="/dashboard" />}
      testId="tracey-dashboard-stats"
    >
      <StatGrid
        items={[
          { label: 'Calls', value: fmtTokens(summary.totalCalls) },
          { label: 'Tokens in', value: fmtTokens(summary.totalInputTokens) },
          { label: 'Tokens out', value: fmtTokens(summary.totalOutputTokens) },
          { label: 'Avg latency', value: fmtLatency(summary.avgLatencyMs) },
          { label: 'Pass rate', value: summary.overallPassRate != null ? fmtPct(summary.overallPassRate) : '—' },
        ]}
      />
      <div className="mt-3 border-t border-hairline pt-2.5 font-mono text-body-sm tabular-nums text-muted">
        {live.tracesPerMinute.toFixed(1)}/min · {fmtLatency(live.p95Ms)} p95 ·{' '}
        {fmtPct(live.errorRate)} errors
      </div>
    </ToolUIFrame>
  );
};
