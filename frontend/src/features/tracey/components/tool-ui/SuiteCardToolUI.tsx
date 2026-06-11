import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { FlaskIcon } from '../../../../components/icons';
import { Badge } from '../../../../components/ui/Badge';
import { agentColor } from '../../../../lib/colors';
import { fmtPct100, fmtRelative } from '../../../../lib/format';
import { EntityCardLink } from './EntityCardLink';
import { useArtifactResult } from '../../useArtifact';

/** Inline renderer for the `get_suite` tool result. */
export const SuiteCardToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const { state, data: suite } = useArtifactResult('suite', result, status, isError);
  return (
    <EntityCardLink
      state={state}
      to="/suites"
      title={suite?.name ?? ''}
      icon={<FlaskIcon size={14} />}
      color={agentColor(suite?.agentId ?? '')}
      testId="tracey-suite-card"
      pendingLabel="Loading suite…"
    >
      {suite && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge label={`${suite.testCases.length} cases`} variant="neutral" size="sm" />
            <Badge label={`${suite.evaluators.length} evaluators`} variant="neutral" size="sm" />
            {suite.passRate != null && (
              <Badge label={`${fmtPct100(suite.passRate)} pass`} variant="neutral" size="sm" />
            )}
          </div>
          <div className="text-body-sm text-muted">
            {suite.agentName} · {suite.totalRuns} runs
            {suite.lastRunAt ? ` · last ${fmtRelative(suite.lastRunAt)}` : ''}
          </div>
        </div>
      )}
    </EntityCardLink>
  );
};
