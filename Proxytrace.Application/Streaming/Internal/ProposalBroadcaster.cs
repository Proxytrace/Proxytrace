namespace Proxytrace.Application.Streaming.Internal;

internal sealed class ProposalBroadcaster : AgentScopedBroadcaster<ProposalEvent>, IProposalBroadcaster
{
    protected override Guid KeyOf(ProposalEvent evt) => evt.AgentId;
}
