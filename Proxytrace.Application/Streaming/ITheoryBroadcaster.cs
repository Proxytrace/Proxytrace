using System.Threading.Channels;
using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.OptimizationTheory;
using Proxytrace.Domain.Proposal;

namespace Proxytrace.Application.Streaming;

public record TheoryStatusChangedEvent(
    Guid Id,
    Guid AgentId,
    ProposalKind Kind,
    TheoryStatus Status,
    TheorySource Source,
    Priority Priority,
    string Rationale,
    Guid? ResultingProposalId,
    DateTimeOffset UpdatedAt)
{
    public static TheoryStatusChangedEvent Create(IOptimizationTheory theory)
        => new(
            theory.Id,
            theory.Agent.Id,
            theory.Kind,
            theory.Status,
            theory.Source,
            theory.Priority,
            theory.Rationale,
            theory.ResultingProposalId,
            theory.UpdatedAt);
}

public interface ITheoryBroadcaster
{
    /// <summary>
    /// Subscribes to theory lifecycle events for a specific agent.
    /// The returned reader is closed when <paramref name="cancellationToken"/> is cancelled.
    /// </summary>
    ChannelReader<TheoryStatusChangedEvent> Subscribe(Guid agentId, CancellationToken cancellationToken);

    void Publish(TheoryStatusChangedEvent evt);
}
