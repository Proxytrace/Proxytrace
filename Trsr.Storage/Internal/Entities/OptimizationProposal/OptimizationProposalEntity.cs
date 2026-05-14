using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.Proposal;

namespace Trsr.Storage.Internal.Entities.OptimizationProposal;

[StoredDomainEntity(typeof(IOptimizationProposal))]
internal record OptimizationProposalEntity : Entity
{
    /// <summary><see cref="IOptimizationProposal.Agent"/></summary>
    public required Guid Agent { get; init; }

    /// <summary><see cref="IOptimizationProposal.Kind"/> — discriminator for deserialization.</summary>
    public required ProposalKind Kind { get; init; }

    /// <summary><see cref="IOptimizationProposal.Status"/></summary>
    public required ProposalStatus Status { get; init; }

    /// <summary><see cref="IOptimizationProposal.Priority"/></summary>
    public required Priority Priority { get; init; }

    /// <summary><see cref="IOptimizationProposal.Rationale"/></summary>
    public required string Rationale { get; init; }

    /// <summary><see cref="IOptimizationProposal.ABTestRun"/></summary>
    public required Guid ABTestRun { get; init; }

    /// <summary>
    /// Kind-specific JSON payload. Shape is determined by <see cref="Kind"/>.
    /// </summary>
    public required string Data { get; init; }

    /// <summary>
    /// <see cref="IOptimizationProposal.EvidenceTestRunIds"/> serialized as JSON.
    /// </summary>
    public required string EvidenceTestRunIds { get; init; }
}
