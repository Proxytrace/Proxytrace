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
    /// Pass rate of the baseline (unchanged agent) A/B run, recorded once the theory has been
    /// validated or invalidated. Null while still Proposed/Validating, or when the run produced
    /// no results.
    /// </summary>
    double? BaselinePassRate { get; }

    /// <summary>
    /// Pass rate of the candidate (changed agent) A/B run, recorded once the theory has been
    /// validated or invalidated. Null while still Proposed/Validating, or when the run produced
    /// no results.
    /// </summary>
    double? ProjectedPassRate { get; }

    /// <summary>
    /// Two-sided p-value of a two-proportion test between the baseline and candidate runs.
    /// A large value (≈ ≥ 0.05) means the observed pass-rate difference is statistically
    /// indistinguishable from noise. Null when sample sizes are insufficient to compute it.
    /// </summary>
    double? PValue { get; }

    /// <summary>
    /// Id of the candidate (changed agent) A/B test run executed during validation, recorded once
    /// the theory has been validated or invalidated. Null while still Proposed/Validating, or when
    /// the run produced no comparable results. The run is a system run, surfaced in the runs view
    /// only when A/B runs are explicitly shown.
    /// </summary>
    Guid? ABTestRunId { get; }

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
    /// Records the candidate A/B run id while the theory is still <see cref="TheoryStatus.Validating"/>,
    /// so the in-flight run can be linked before the comparison completes. Idempotent; the final
    /// <see cref="SetValidated"/>/<see cref="SetInvalidated"/> transition re-affirms the same id.
    /// </summary>
    Task<IOptimizationTheory> AttachAbTestRun(Guid abTestRunId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Transitions the theory to <see cref="TheoryStatus.Validated"/>, records the spawned proposal,
    /// and stores the A/B validation metrics that justified it.
    /// </summary>
    Task<IOptimizationTheory> SetValidated(
        Guid resultingProposalId,
        double? baselinePassRate,
        double? projectedPassRate,
        double? pValue,
        Guid? abTestRunId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Transitions the theory to <see cref="TheoryStatus.Invalidated"/> and stores the A/B
    /// validation metrics observed, when available.
    /// </summary>
    Task<IOptimizationTheory> SetInvalidated(
        double? baselinePassRate,
        double? projectedPassRate,
        double? pValue,
        Guid? abTestRunId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Dismisses an active theory (<see cref="TheoryStatus.Proposed"/> or
    /// <see cref="TheoryStatus.Validating"/>) to <see cref="TheoryStatus.Invalidated"/> on a user's
    /// explicit request — skipping A/B validation for a Proposed theory, or cancelling it for a
    /// Validating one. Unlike <see cref="SetInvalidated"/> (which the pipeline calls with the A/B
    /// metrics that disproved the theory) this records no metrics; any A/B run already linked while
    /// validating is preserved for provenance. The absence of metrics is what distinguishes a manual
    /// dismissal from an A/B-disproven invalidation.
    /// </summary>
    Task<IOptimizationTheory> Reject(CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns a terminal theory (<see cref="TheoryStatus.Validated"/> or
    /// <see cref="TheoryStatus.Invalidated"/>) to <see cref="TheoryStatus.Proposed"/>, clearing the
    /// recorded proposal reference, A/B metrics, and run link so it can be validated afresh. Callers
    /// are responsible for deleting any spawned proposal and re-queuing the theory.
    /// </summary>
    Task<IOptimizationTheory> ResetToProposed(CancellationToken cancellationToken = default);
}
