namespace Proxytrace.Application.Streaming.Internal;

internal sealed class ProposalBroadcaster : AgentScopedBroadcaster<ProposalCreatedEvent>, IProposalBroadcaster
{
    protected override Guid KeyOf(ProposalCreatedEvent evt) => evt.AgentId;
}
