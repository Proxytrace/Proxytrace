import { useLingui } from '@lingui/react/macro';
import { Badge } from '../../../../components/ui/Badge';
import { NotificationTargetKind } from '../../../../api/models';
import { targetRoute } from '../../notificationsMeta';
import {
  priorityLabel,
  proposalKindLabel,
  proposalStatusLabel,
  proposalStatusVariant,
} from '../../targetPreviewMeta';
import { useProposalTarget } from '../../hooks/useNotificationTarget';
import { TargetPreviewCard, TargetPreviewRow } from './TargetPreviewCard';

/** Live summary of the optimization proposal a notification was raised for. */
export function ProposalPreview({ id }: { id: string }) {
  const { t, i18n } = useLingui();
  const { data: proposal, isPending } = useProposalTarget(id);

  return (
    <TargetPreviewCard
      eyebrow={t`Proposal`}
      state={isPending ? 'loading' : proposal ? 'ready' : 'missing'}
      title={proposal ? i18n._(proposalKindLabel(proposal.kind)) : undefined}
      route={targetRoute(NotificationTargetKind.OptimizationProposal, id)}
      ctaLabel={t`Open proposal`}
    >
      {proposal && (
        <>
          <TargetPreviewRow label={t`Agent`} value={proposal.agentName} />
          <TargetPreviewRow
            label={t`Status`}
            value={
              <Badge
                label={i18n._(proposalStatusLabel(proposal.status))}
                variant={proposalStatusVariant(proposal.status)}
                size="sm"
              />
            }
          />
          <TargetPreviewRow label={t`Priority`} value={i18n._(priorityLabel(proposal.priority))} />
        </>
      )}
    </TargetPreviewCard>
  );
}
