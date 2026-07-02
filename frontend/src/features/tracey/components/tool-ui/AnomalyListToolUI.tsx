import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { useLingui } from '@lingui/react/macro';
import { AlertTriangleIcon } from '../../../../components/icons';
import { Badge } from '../../../../components/ui/Badge';
import { modelColor } from '../../../../lib/colors';
import { fmtLatency } from '../../../../lib/format';
import { OUTLIER_FLAG_LABEL, outlierFlagKeys } from '../../../../lib/outliers';
import { ListCard, LIST_CARD_MAX } from './ListCard';
import { ListCardRow } from './ListCardRow';
import { useArtifactResult } from '../../useArtifact';

/** Inline renderer for the `get_agent_anomalies` tool result: flagged calls + their reasons. */
export const AnomalyListToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const { t, i18n } = useLingui();
  // eslint-disable-next-line lingui/no-unlocalized-strings -- artifact kind token, not UI copy
  const { state, data } = useArtifactResult('trace-list', result, status, isError);
  const traces = data ?? [];
  return (
    <ListCard
      state={state}
      icon={<AlertTriangleIcon size={14} />}
      title={t`Anomalies`}
      count={traces.length}
      shown={Math.min(traces.length, LIST_CARD_MAX)}
      viewAllTo="/traces"
      pendingLabel={t`Loading anomalies…`}
      emptyLabel={t`No anomalies flagged recently.`}
      testId="tracey-anomaly-list"
    >
      {traces.slice(0, LIST_CARD_MAX).map((trace) => (
        <ListCardRow
          key={trace.id}
          to={`/traces?focus=${trace.id}`}
          color={modelColor(trace.model)}
          title={trace.messagePreview ?? trace.agentName ?? trace.model}
          subtitle={<span className="font-mono">{trace.model}</span>}
          right={
            <span className="inline-flex items-center gap-1.5">
              {outlierFlagKeys(trace.outlierFlags).map((key) => (
                <Badge key={key} label={i18n._(OUTLIER_FLAG_LABEL[key])} variant="warn" size="sm" />
              ))}
              <span className="font-mono text-body-sm tabular-nums text-muted">
                {fmtLatency(trace.durationMs)}
              </span>
            </span>
          }
        />
      ))}
    </ListCard>
  );
};
