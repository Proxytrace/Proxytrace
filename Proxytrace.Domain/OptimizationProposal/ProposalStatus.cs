namespace Proxytrace.Domain.OptimizationProposal;

/// <summary>
/// Lifecycle state of an <see cref="IOptimizationProposal"/>.
/// Proposals are always human-reviewed before any changes are applied.
/// </summary>
public enum ProposalStatus
{
    /// <summary>Generated from test evidence; awaiting human review.</summary>
    Draft,

    /// <summary>Reviewed and approved for implementation.</summary>
    Accepted,

    /// <summary>Reviewed and dismissed.</summary>
    Rejected,

    /// <summary>
    /// Accepted and subsequently observed live in the agent's ingested traffic (auto-detected)
    /// or confirmed as applied by a human (manual).
    /// </summary>
    Adopted,
}
