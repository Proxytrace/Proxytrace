import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { useLingui } from '@lingui/react/macro';
import { ScaleIcon } from '../../../../components/icons';
import { Badge } from '../../../../components/ui/Badge';
import { ListCard, LIST_CARD_MAX } from './ListCard';
import { ListCardRow } from './ListCardRow';
import { useArtifactResult } from '../../useArtifact';

/** Inline renderer for the `list_evaluators` tool result. */
export const EvaluatorListToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const { t } = useLingui();
  // eslint-disable-next-line lingui/no-unlocalized-strings -- artifact kind token, not UI copy
  const { state, data } = useArtifactResult('evaluator-list', result, status, isError);
  const evaluators = data ?? [];
  return (
    <ListCard
      state={state}
      icon={<ScaleIcon size={14} />}
      title={t`Evaluators`}
      count={evaluators.length}
      shown={Math.min(evaluators.length, LIST_CARD_MAX)}
      viewAllTo="/evaluators"
      pendingLabel={t`Loading evaluators…`}
      emptyLabel={t`No evaluators in this project yet.`}
      testId="tracey-evaluator-list"
    >
      {evaluators.slice(0, LIST_CARD_MAX).map((evaluator) => (
        <ListCardRow
          key={evaluator.id}
          to={`/evaluators?id=${evaluator.id}`}
          title={evaluator.name}
          right={<Badge label={evaluator.kind} variant="neutral" size="sm" />}
        />
      ))}
    </ListCard>
  );
};
