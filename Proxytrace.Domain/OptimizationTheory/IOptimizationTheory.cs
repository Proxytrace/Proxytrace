using Proxytrace.Domain.Agent;
using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.Proposal;
using Proxytrace.Domain.TestSuite;

namespace Proxytrace.Domain.OptimizationTheory;

/// <summary>
/// An unproven hypothesis that a specific change to an agent will improve it.
/// Theories may be produced by built-in optimizers or submitted by third parties
/// (users, Tracey AI, external callers). Each theory is validated by an A/B test run;
/// a winning theory spawns a reviewable <see cref="IOptimizationProposal"/>.
/// </summary>
public interface IOptimizationTheory : IDomainEntity
{
    /// <summary>The agent this theory targets.</summary>
    IAgent Agent { get; }

    /// <summary>The test suite the theory is validated against.</summary>
    ITestSuite Suite { get; }

    /// <summary>Which aspect of the agent the theory proposes to change.</summary>
    ProposalKind Kind { get; }

    /// <summary>Current lifecycle state of this theory.</summary>
    TheoryStatus Status { get; }

    /// <summary>Who produced this theory.</summary>
    TheorySource Source { get; }

    /// <summary>Relative importance of validating this theory.</summary>
    Priority Priority { get; }

    /// <summary>Human-readable explanation of why this change is hypothesised to help.</summary>
    string Rationale { get; }

    /// <summary>
    /// IDs of the <see cref="TestRun.ITestRun"/> instances whose results motivated this theory.
    /// May be empty for externally-submitted theories.
    /// </summary>
    IReadOnlyCollection<Guid> EvidenceTestRunIds { get; }

    /// <summary>
    /// The <see cref="IOptimizationProposal"/> spawned when this theory was validated, if any.
    /// </summary>
    Guid? ResultingProposalId { get; }

    /// <summary>
    /// Deterministic fingerprint of <see cref="Agent"/> + <see cref="Kind"/> + proposed-change payload.
    /// Shares the same computation as <see cref="IOptimizationProposal.ContentHash"/> so theories and
    /// proposals deduplicate against each other.
    /// </summary>
    string ContentHash { get; }

    /// <summary>
    /// Transitions the theory to <see cref="TheoryStatus.Validating"/>.
    /// </summary>
    Task<IOptimizationTheory> SetValidating(CancellationToken cancellationToken = default);

    /// <summary>
    /// Transitions the theory to <see cref="TheoryStatus.Validated"/> and records the spawned proposal.
    /// </summary>
    Task<IOptimizationTheory> SetValidated(Guid resultingProposalId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Transitions the theory to <see cref="TheoryStatus.Invalidated"/>.
    /// </summary>
    Task<IOptimizationTheory> SetInvalidated(CancellationToken cancellationToken = default);
}
