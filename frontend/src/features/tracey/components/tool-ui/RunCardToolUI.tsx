import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { PlayIcon } from '../../../../components/icons';
import { Badge } from '../../../../components/ui/Badge';
import { agentColor } from '../../../../lib/colors';
import { fmtPct100, fmtCost, fmtTokens } from '../../../../lib/format';
import { EntityCardLink } from './EntityCardLink';
import { RUN_STATUS_VARIANT } from './badge-variants';
import { useArtifactResult } from '../../useArtifact';

/** Inline renderer for the `get_run` tool result. */
export const RunCardToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const { t } = useLingui();
  // eslint-disable-next-line lingui/no-unlocalized-strings -- artifact kind token, not UI copy
  const { state, data: run } = useArtifactResult('run', result, status, isError);
  return (
    <EntityCardLink
      state={state}
      to={run ? `/runs?run=${run.id}` : '/runs'}
      title={run ? `${run.suiteName ?? t`Suite`} → ${run.agentName}` : ''}
      icon={<PlayIcon size={14} />}
      color={agentColor(run?.agentId ?? '')}
      testId="tracey-run-card"
      pendingLabel={t`Loading run…`}
    >
      {run && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge label={run.status} variant={RUN_STATUS_VARIANT[run.status]} size="sm" />
            <Badge label={t`${fmtPct100(run.passRate)} pass`} variant="neutral" size="sm" />
          </div>
          <div className="font-mono text-body-sm tabular-nums text-muted">
            <Trans>
              {run.passedCases}/{run.totalCases} passed · {fmtCost(run.costEur)} · {fmtTokens((run.tokensIn ?? 0) + (run.tokensOut ?? 0))} tok
            </Trans>
          </div>
        </div>
      )}
    </EntityCardLink>
  );
};
