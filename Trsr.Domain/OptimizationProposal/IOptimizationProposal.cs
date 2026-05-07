using Trsr.Domain.Agent;
using Trsr.Domain.Proposal;

namespace Trsr.Domain.OptimizationProposal;

/// <summary>
/// A structured, reviewable suggestion to improve an agent derived from test-run evidence.
/// Proposals are always human-reviewed; there is no automatic rollout.
/// </summary>
public interface IOptimizationProposal : IDomainEntity
{
    /// <summary>The agent this proposal targets.</summary>
    IAgent Agent { get; }

    /// <summary>Which aspect of the agent is being proposed for change. Derived from <see cref="Details"/> type.</summary>
    ProposalKind Kind { get; }

    /// <summary>Current review state of this proposal.</summary>
    ProposalStatus Status { get; }

    /// <summary>Relative importance of acting on this proposal.</summary>
    Priority Priority { get; }

    /// <summary>
    /// Human-readable explanation of why this proposal was generated,
    /// referencing the test evidence that motivated it.
    /// </summary>
    string Rationale { get; }

    /// <summary>Typed payload carrying the optimizer-specific proposed changes.</summary>
    ProposalDetails Details { get; }

    /// <summary>
    /// IDs of the <see cref="TestRun.ITestRun"/> instances whose results motivated this proposal.
    /// </summary>
    IReadOnlyCollection<Guid> EvidenceTestRunIds { get; }

    /// <summary>Factory delegate for creating a new optimization proposal.</summary>
    public delegate IOptimizationProposal CreateNew(
        IAgent agent,
        Priority priority,
        string rationale,
        ProposalDetails details,
        IReadOnlyCollection<Guid> evidenceTestRunIds);

    /// <summary>Factory delegate for reconstituting an existing optimization proposal from persistence.</summary>
    public delegate IOptimizationProposal CreateExisting(
        IAgent agent,
        ProposalStatus status,
        Priority priority,
        string rationale,
        ProposalDetails details,
        IReadOnlyCollection<Guid> evidenceTestRunIds,
        IDomainEntityData existing);
}
