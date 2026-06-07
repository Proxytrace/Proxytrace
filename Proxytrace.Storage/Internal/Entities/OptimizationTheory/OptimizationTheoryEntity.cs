using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.OptimizationTheory;
using Proxytrace.Domain.Proposal;

namespace Proxytrace.Storage.Internal.Entities.OptimizationTheory;

[StoredDomainEntity(typeof(IOptimizationTheory))]
internal record OptimizationTheoryEntity : Entity
{
    /// <summary><see cref="IOptimizationTheory.Agent"/></summary>
    public required Guid Agent { get; init; }

    /// <summary><see cref="IOptimizationTheory.Suite"/></summary>
    public required Guid Suite { get; init; }

    /// <summary><see cref="IOptimizationTheory.Kind"/> — discriminator for deserialization.</summary>
    public required ProposalKind Kind { get; init; }

    /// <summary><see cref="IOptimizationTheory.Status"/></summary>
    public required TheoryStatus Status { get; init; }

    /// <summary><see cref="IOptimizationTheory.Source"/></summary>
    public required TheorySource Source { get; init; }

    /// <summary><see cref="IOptimizationTheory.Priority"/></summary>
    public required Priority Priority { get; init; }

    /// <summary><see cref="IOptimizationTheory.Rationale"/></summary>
    public required string Rationale { get; init; }

    /// <summary>
    /// Kind-specific JSON payload. Shape is determined by <see cref="Kind"/>.
    /// </summary>
    public required string Data { get; init; }

    /// <summary>
    /// <see cref="IOptimizationTheory.EvidenceTestRunIds"/> serialized as JSON.
    /// </summary>
    public required string EvidenceTestRunIds { get; init; }

    /// <summary><see cref="IOptimizationTheory.ResultingProposalId"/></summary>
    public Guid? ResultingProposalId { get; init; }

    /// <summary><see cref="IOptimizationTheory.BaselinePassRate"/></summary>
    public double? BaselinePassRate { get; init; }

    /// <summary><see cref="IOptimizationTheory.ProjectedPassRate"/></summary>
    public double? ProjectedPassRate { get; init; }

    /// <summary><see cref="IOptimizationTheory.PValue"/></summary>
    public double? PValue { get; init; }

    /// <summary><see cref="IOptimizationTheory.ABTestRunId"/></summary>
    public Guid? ABTestRunId { get; init; }

    /// <summary><see cref="IOptimizationTheory.ContentHash"/></summary>
    public required string ContentHash { get; init; }
}
