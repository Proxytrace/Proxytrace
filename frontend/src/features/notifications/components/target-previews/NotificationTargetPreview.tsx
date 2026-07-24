import { NotificationTargetKind } from '../../../../api/models';
import { TestRunGroupPreview } from './TestRunGroupPreview';
import { AgentPreview } from './AgentPreview';
import { ProposalPreview } from './ProposalPreview';
import { AgentCallPreview } from './AgentCallPreview';

interface NotificationTargetPreviewProps {
  targetKind: NotificationTargetKind | null;
  targetId: string | null;
}

/**
 * Renders the preview for whatever a notification points at. One child component per target kind
 * so each owns its own by-id query — a single component switching hooks would break the rules of
 * hooks. An unknown kind (a newer backend enum member) renders nothing rather than throwing.
 */
export function NotificationTargetPreview({ targetKind, targetId }: NotificationTargetPreviewProps) {
  if (!targetKind || !targetId) return null;

  switch (targetKind) {
    case NotificationTargetKind.TestRunGroup:
      return <TestRunGroupPreview id={targetId} />;
    case NotificationTargetKind.Agent:
      return <AgentPreview id={targetId} />;
    case NotificationTargetKind.OptimizationProposal:
      return <ProposalPreview id={targetId} />;
    case NotificationTargetKind.AgentCall:
      return <AgentCallPreview id={targetId} />;
    default:
      return null;
  }
}
