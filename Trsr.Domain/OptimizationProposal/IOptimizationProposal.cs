using Trsr.Domain.Agent;
using Trsr.Domain.Proposal;
using Trsr.Domain.TestRun;

namespace Trsr.Domain.OptimizationProposal;

/// <summary>
/// A structured, reviewable suggestion to improve an agent derived from test-run evidence.
/// Proposals are always human-reviewed; there is no automatic rollout.
/// </summary>
public interface IOptimizationProposal : IDomainEntity
{
    /// <summary>The agent this proposal targets.</summary>
    IAgent Agent { get; }

    /// <summary>Which aspect of the agent is being proposed for change.</summary>
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
    
    /// <summary>
    /// A/B Test run 
    /// </summary>
    ITestRun ABTestRun { get; }

    /// <summary>
    /// IDs of the <see cref="TestRun.ITestRun"/> instances whose results motivated this proposal.
    /// </summary>
    IReadOnlyCollection<Guid> EvidenceTestRunIds { get; }
}
