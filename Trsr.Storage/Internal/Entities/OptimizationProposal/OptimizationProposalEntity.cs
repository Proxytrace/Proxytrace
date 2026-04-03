using Trsr.Domain.OptimizationProposal;

namespace Trsr.Storage.Internal.Entities.OptimizationProposal;

[StoredDomainEntity(typeof(IOptimizationProposal))]
internal record OptimizationProposalEntity : Entity
{
    /// <summary><see cref="IOptimizationProposal.Agent"/></summary>
    public required Guid Agent { get; init; }

    /// <summary><see cref="IOptimizationProposal.Kind"/></summary>
    public required ProposalKind Kind { get; init; }

    /// <summary><see cref="IOptimizationProposal.Status"/></summary>
    public required ProposalStatus Status { get; init; }

    /// <summary><see cref="IOptimizationProposal.Rationale"/></summary>
    public required string Rationale { get; init; }

    /// <summary>
    /// <see cref="IOptimizationProposal.ProposedSystemMessage"/> serialized as JSON, or null.
    /// </summary>
    public string? ProposedSystemMessage { get; init; }

    /// <summary>
    /// <see cref="IOptimizationProposal.ProposedTools"/> serialized as JSON.
    /// </summary>
    public required string ProposedTools { get; init; }

    /// <summary>
    /// <see cref="IOptimizationProposal.EvidenceTestRunIds"/> serialized as JSON.
    /// </summary>
    public required string EvidenceTestRunIds { get; init; }
}
