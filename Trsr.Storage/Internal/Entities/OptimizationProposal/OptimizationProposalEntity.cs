using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.Proposal;

namespace Trsr.Storage.Internal.Entities.OptimizationProposal;

[StoredDomainEntity(typeof(IOptimizationProposal))]
internal record OptimizationProposalEntity : Entity
{
    /// <summary><see cref="IOptimizationProposal.Agent"/></summary>
    public required Guid Agent { get; init; }

    /// <summary><see cref="IOptimizationProposal.Kind"/> — stored for indexed querying.</summary>
    public required ProposalKind Kind { get; init; }

    /// <summary><see cref="IOptimizationProposal.Status"/></summary>
    public required ProposalStatus Status { get; init; }

    /// <summary><see cref="IOptimizationProposal.Priority"/></summary>
    public required Priority Priority { get; init; }

    /// <summary><see cref="IOptimizationProposal.Rationale"/></summary>
    public required string Rationale { get; init; }

    /// <summary>
    /// <see cref="IOptimizationProposal.Details"/> serialized as JSON.
    /// Deserialize using <see cref="Kind"/> to select the concrete <see cref="ProposalDetails"/> subtype.
    /// </summary>
    public required string Details { get; init; }

    /// <summary>
    /// <see cref="IOptimizationProposal.EvidenceTestRunIds"/> serialized as JSON.
    /// </summary>
    public required string EvidenceTestRunIds { get; init; }
}
