import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { useLingui } from '@lingui/react/macro';
import { PlayIcon } from '../../../../components/icons';
import { Badge } from '../../../../components/ui/Badge';
import { agentColor } from '../../../../lib/colors';
import { fmtPct100 } from '../../../../lib/format';
import { ListCard, LIST_CARD_MAX } from './ListCard';
import { ListCardRow } from './ListCardRow';
import { RUN_STATUS_VARIANT } from './badge-variants';
import { useArtifactResult } from '../../useArtifact';

/** Inline renderer for the `list_runs` tool result. */
export const RunListToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const { t } = useLingui();
  // eslint-disable-next-line lingui/no-unlocalized-strings -- artifact kind token, not UI copy
  const { state, data } = useArtifactResult('run-list', result, status, isError);
  const runs = data ?? [];
  return (
    <ListCard
      state={state}
      icon={<PlayIcon size={14} />}
      title={t`Test runs`}
      count={runs.length}
      shown={Math.min(runs.length, LIST_CARD_MAX)}
      viewAllTo="/runs"
      pendingLabel={t`Loading runs…`}
      emptyLabel={t`No test runs yet.`}
      testId="tracey-run-list"
    >
      {runs.slice(0, LIST_CARD_MAX).map((run) => (
        <ListCardRow
          key={run.id}
          to={`/runs?run=${run.id}`}
          color={agentColor(run.agentId)}
          title={`${run.suiteName ?? t`Suite`} → ${run.agentName}`}
          subtitle={t`${run.passedCases}/${run.totalCases} passed · ${fmtPct100(run.passRate)}`}
          right={<Badge label={run.status} variant={RUN_STATUS_VARIANT[run.status]} size="sm" />}
        />
      ))}
    </ListCard>
  );
};
