import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { PlayIcon } from '../../../../components/icons';
import { Badge } from '../../../../components/ui/Badge';
import { agentColor } from '../../../../lib/colors';
import { fmtPct } from '../../../../lib/format';
import type { TestRunDto } from '../../../../api/models';
import { ListCard, LIST_CARD_MAX } from './ListCard';
import { ListCardRow } from './ListCardRow';
import { RUN_STATUS_VARIANT } from './badge-variants';
import { toolUiState } from './tool-ui-state';

/** Inline renderer for the `list_runs` tool result. */
export const RunListToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const state = toolUiState(status, isError, result != null);
  const runs = Array.isArray(result) ? (result as TestRunDto[]) : [];
  return (
    <ListCard
      state={state}
      icon={<PlayIcon size={14} />}
      title="Test runs"
      count={runs.length}
      shown={Math.min(runs.length, LIST_CARD_MAX)}
      viewAllTo="/runs"
      pendingLabel="Loading runs…"
      emptyLabel="No test runs yet."
      testId="tracey-run-list"
    >
      {runs.slice(0, LIST_CARD_MAX).map((run) => (
        <ListCardRow
          key={run.id}
          to={`/runs?run=${run.id}`}
          color={agentColor(run.agentId)}
          title={`${run.suiteName ?? 'Suite'} → ${run.agentName}`}
          subtitle={`${run.passedCases}/${run.totalCases} passed · ${fmtPct(run.passRate)}`}
          right={<Badge label={run.status} variant={RUN_STATUS_VARIANT[run.status]} size="sm" />}
        />
      ))}
    </ListCard>
  );
};
