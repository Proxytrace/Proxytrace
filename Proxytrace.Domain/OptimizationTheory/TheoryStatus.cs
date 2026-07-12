namespace Proxytrace.Domain.OptimizationTheory;

/// <summary>
/// Lifecycle state of an <see cref="IOptimizationTheory"/>.
/// A theory is an unproven hypothesis; validation either promotes it to a
/// proposal (Validated), discards it (Invalidated), or — when the A/B run
/// itself could not be carried out — parks it as Failed for a retry.
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

    /// <summary>
    /// The A/B validation could not be carried out (unreachable provider, upstream error,
    /// incomplete run) — the theory was neither proven nor disproven. Unlike
    /// <see cref="Invalidated"/> it says nothing about the theory's merit: it is excluded
    /// from win-rate statistics and can be retried via a reset to <see cref="Proposed"/>.
    /// </summary>
    Failed,
}
