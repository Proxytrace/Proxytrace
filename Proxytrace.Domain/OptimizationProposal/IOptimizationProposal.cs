using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentVersion;
using Proxytrace.Domain.Proposal;
using Proxytrace.Domain.TestRun;

namespace Proxytrace.Domain.OptimizationProposal;

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

    /// <summary>Pass-rate of the baseline (current) run before applying this proposal.</summary>
    double? CurrentPassRate { get; }

    /// <summary>Pass-rate observed when the proposal was applied (in the A/B run).</summary>
    double? ProposedPassRate { get; }

    /// <summary>Convenience: <see cref="ProposedPassRate"/> − <see cref="CurrentPassRate"/>.</summary>
    double? ExpectedPassRateDelta
        => ProposedPassRate.HasValue && CurrentPassRate.HasValue
            ? ProposedPassRate.Value - CurrentPassRate.Value
            : null;

    /// <summary>
    /// Deterministic fingerprint of <see cref="Agent"/> + <see cref="Kind"/> + proposed-change payload.
    /// Used to suppress re-creation of an identical proposal that was already Accepted or Rejected.
    /// </summary>
    string ContentHash { get; }

    /// <summary>When the proposed change was observed live (or confirmed manually); null until Adopted.</summary>
    DateTimeOffset? AdoptedAt { get; }

    /// <summary>
    /// The <see cref="IAgentVersion"/> in which the change was auto-detected;
    /// null for model switches and manual adoptions.
    /// </summary>
    Guid? AdoptedAgentVersionId { get; }

    /// <summary>
    /// Version number of <see cref="AdoptedAgentVersionId"/> captured at adoption time
    /// (denormalized for display; the id stays authoritative if the version is renumbered).
    /// </summary>
    int? AdoptedAgentVersionNumber { get; }

    /// <summary>Whether adoption was confirmed by a human rather than auto-detected; null until Adopted.</summary>
    bool? AdoptedManually { get; }

    /// <summary>
    /// Promotes the proposal for implementation. Only valid from <see cref="ProposalStatus.Draft"/>.
    /// </summary>
    Task<IOptimizationProposal> Accept(CancellationToken cancellationToken = default);

    /// <summary>
    /// Dismisses the proposal. Only valid from <see cref="ProposalStatus.Draft"/>.
    /// </summary>
    Task<IOptimizationProposal> Reject(CancellationToken cancellationToken = default);

    /// <summary>
    /// Records that the promoted change is live in the agent — either auto-detected in ingested
    /// traffic (pass the version it was seen in) or confirmed manually. Only valid from
    /// <see cref="ProposalStatus.Accepted"/>.
    /// </summary>
    Task<IOptimizationProposal> MarkAdopted(IAgentVersion? adoptedVersion, bool manual, CancellationToken cancellationToken = default);
}
