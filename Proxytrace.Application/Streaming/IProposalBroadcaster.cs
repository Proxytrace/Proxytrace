using System.Threading.Channels;
using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.Proposal;

namespace Proxytrace.Application.Streaming;

public record ProposalCreatedEvent(
    Guid Id,
    Guid AgentId,
    ProposalKind Kind,
    Priority Priority,
    string Rationale,
    DateTimeOffset CreatedAt)
{
    public static ProposalCreatedEvent Create(IOptimizationProposal proposal)
        => new(
            proposal.Id,
            proposal.Agent.Id,
            proposal.Kind,
            proposal.Priority,
            proposal.Rationale,
            proposal.CreatedAt);
}

public interface IProposalBroadcaster
{
    /// <summary>
    /// Subscribes to new proposals for a specific agent.
    /// The returned reader is closed when <paramref name="cancellationToken"/> is cancelled.
    /// </summary>
    ChannelReader<ProposalCreatedEvent> Subscribe(Guid agentId, CancellationToken cancellationToken);

    void Publish(ProposalCreatedEvent evt);
}
