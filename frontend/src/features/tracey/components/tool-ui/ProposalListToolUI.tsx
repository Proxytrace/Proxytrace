import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { useLingui } from '@lingui/react/macro';
import { SparklesIcon } from '../../../../components/icons';
import { Badge } from '../../../../components/ui/Badge';
import { agentColor } from '../../../../lib/colors';
import { ListCard, LIST_CARD_MAX } from './ListCard';
import { ListCardRow } from './ListCardRow';
import { PRIORITY_VARIANT } from './badge-variants';
import { useArtifactResult } from '../../useArtifact';

/** Inline renderer for the `list_proposals` tool result. */
export const ProposalListToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const { t } = useLingui();
  const { state, data } = useArtifactResult('proposal-list', result, status, isError);
  const proposals = data ?? [];
  return (
    <ListCard
      state={state}
      icon={<SparklesIcon size={14} />}
      title={t`Proposals`}
      count={proposals.length}
      shown={Math.min(proposals.length, LIST_CARD_MAX)}
      viewAllTo="/proposals"
      pendingLabel={t`Loading proposals…`}
      emptyLabel={t`No optimization proposals yet.`}
      testId="tracey-proposal-list"
    >
      {proposals.slice(0, LIST_CARD_MAX).map((proposal) => (
        <ListCardRow
          key={proposal.id}
          to={`/proposals?agentId=${proposal.agentId}`}
          color={agentColor(proposal.agentId)}
          title={`${proposal.kind} · ${proposal.agentName}`}
          subtitle={proposal.rationale}
          right={<Badge label={proposal.priority} variant={PRIORITY_VARIANT[proposal.priority]} size="sm" />}
        />
      ))}
    </ListCard>
  );
};
