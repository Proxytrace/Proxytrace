import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { SparklesIcon } from '../../../../components/icons';
import { Badge } from '../../../../components/ui/Badge';
import { agentColor } from '../../../../lib/colors';
import { type OptimizationProposalDto } from '../../../../api/models';
import { EntityCardLink } from './EntityCardLink';
import { ToolUIFrame } from './ToolUIFrame';
import { PRIORITY_VARIANT, PROPOSAL_STATUS_VARIANT } from './badge-variants';
import { useArtifactResult } from '../../useArtifact';

function isProposal(value: unknown): value is OptimizationProposalDto {
  return typeof value === 'object' && value !== null && 'kind' in value && 'rationale' in value;
}

/** Inline renderer for the `get_proposal` tool result. */
export const ProposalCardToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const { state, data } = useArtifactResult<OptimizationProposalDto>(result, status, isError);
  if (state !== 'ready') {
    return <ToolUIFrame state={state} pendingLabel="Loading proposal…" testId="tracey-proposal-card" />;
  }
  if (!isProposal(data)) {
    return <ToolUIFrame state="error" errorLabel="Proposal not found." testId="tracey-proposal-card" />;
  }
  const proposal = data;
  return (
    <EntityCardLink
      state="ready"
      to={`/proposals?agentId=${proposal.agentId}`}
      title={`${proposal.kind} for ${proposal.agentName}`}
      icon={<SparklesIcon size={14} />}
      color={agentColor(proposal.agentId)}
      testId="tracey-proposal-card"
      pendingLabel="Loading proposal…"
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge label={proposal.status} variant={PROPOSAL_STATUS_VARIANT[proposal.status]} size="sm" />
          <Badge label={proposal.priority} variant={PRIORITY_VARIANT[proposal.priority]} size="sm" />
        </div>
        <div className="line-clamp-2 text-body-sm text-secondary">{proposal.rationale}</div>
      </div>
    </EntityCardLink>
  );
};
