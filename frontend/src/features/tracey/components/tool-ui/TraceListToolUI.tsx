import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { ActivityIcon } from '../../../../components/icons';
import { Badge } from '../../../../components/ui/Badge';
import { modelColor } from '../../../../lib/colors';
import { fmtLatency } from '../../../../lib/format';
import { ListCard, LIST_CARD_MAX } from './ListCard';
import { ListCardRow } from './ListCardRow';
import { useArtifactResult } from '../../useArtifact';

/** Inline renderer for the `find_traces` tool result. */
export const TraceListToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const { state, data } = useArtifactResult('trace-list', result, status, isError);
  const traces = data ?? [];
  return (
    <ListCard
      state={state}
      icon={<ActivityIcon size={14} />}
      title="Traces"
      count={traces.length}
      shown={Math.min(traces.length, LIST_CARD_MAX)}
      viewAllTo="/traces"
      pendingLabel="Searching traces…"
      emptyLabel="No traces matched."
      testId="tracey-trace-list"
    >
      {traces.slice(0, LIST_CARD_MAX).map((trace) => (
        <ListCardRow
          key={trace.id}
          to={`/traces?focus=${trace.id}`}
          color={modelColor(trace.model)}
          title={trace.messagePreview ?? trace.agentName ?? trace.model}
          subtitle={
            <>
              {trace.agentName ? `${trace.agentName} · ` : ''}
              <span className="font-mono">{trace.model}</span>
              {trace.errorMessage ? ` · ${trace.errorMessage}` : ''}
            </>
          }
          right={
            <span className="inline-flex items-center gap-2">
              {trace.httpStatus >= 400 && (
                <Badge label={String(trace.httpStatus)} variant="danger" size="sm" />
              )}
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
