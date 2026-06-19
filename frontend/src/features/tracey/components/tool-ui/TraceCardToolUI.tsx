import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { ActivityIcon } from '../../../../components/icons';
import { StatusDot } from '../../../../components/ui/StatusDot';
import { Pill } from '../../../../components/ui/Pill';
import { modelColor, providerColor } from '../../../../lib/colors';
import { fmtTokens, fmtDuration, fmtCost } from '../../../../lib/format';
import { EntityCardLink } from './EntityCardLink';
import { useArtifactResult } from '../../useArtifact';

/** Inline renderer for the `get_trace` tool result. */
export const TraceCardToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const { t } = useLingui();
  const { state, data: trace } = useArtifactResult('trace', result, status, isError);
  return (
    <EntityCardLink
      state={state}
      to={trace ? `/traces?focus=${trace.id}` : '/traces'}
      title={trace ? (trace.agentName ?? trace.model) : ''}
      icon={<ActivityIcon size={14} />}
      color={modelColor(trace?.model ?? '')}
      testId="tracey-trace-card"
      pendingLabel={t`Loading trace…`}
    >
      {trace && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusDot httpStatus={trace.httpStatus} />
            <Pill label={trace.model} color={modelColor(trace.model)} size="sm" />
            <Pill label={trace.provider} color={providerColor(trace.provider)} size="sm" />
          </div>
          <div className="font-mono text-body-sm tabular-nums text-muted">
            <Trans>
              {fmtTokens(trace.inputTokens)} in · {fmtTokens(trace.outputTokens)} out · {fmtDuration(trace.durationMs)} · {fmtCost(trace.costEur)}
            </Trans>
          </div>
        </div>
      )}
    </EntityCardLink>
  );
};
