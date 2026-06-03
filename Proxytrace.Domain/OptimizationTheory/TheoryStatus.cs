namespace Proxytrace.Domain.OptimizationTheory;

/// <summary>
/// Lifecycle state of an <see cref="IOptimizationTheory"/>.
/// A theory is an unproven hypothesis; validation either promotes it to a
/// proposal (Validated) or discards it (Invalidated).
/// </summary>
public enum TheoryStatus
{
    /// <summary>Submitted hypothesis awaiting validation.</summary>
    Proposed,

    /// <summary>An A/B validation run is currently executing for this theory.</summary>
    Validating,

    /// <summary>Validation showed an improvement; an <see cref="OptimizationProposal.IOptimizationProposal"/> was spawned.</summary>
    Validated,

    /// <summary>Validation showed no improvement; kept for provenance.</summary>
    Invalidated,
}
