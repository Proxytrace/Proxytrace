using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.OptimizationTheory;

namespace Proxytrace.Application.Optimization.Internal.Validation;

/// <summary>
/// Result of grounding a theory against a baseline and a candidate A/B run. The metrics are
/// recorded on the theory regardless of outcome; <see cref="Proposal"/> is non-null only when
/// the change improved the agent enough to spawn a Draft proposal. <see cref="NotTested"/>
/// marks a comparison that never happened — the theory ends up Failed, not Invalidated.
/// </summary>
internal readonly record struct TheoryValidationOutcome(
    IOptimizationProposal? Proposal,
    double? BaselinePassRate,
    double? ProjectedPassRate,
    double? PValue,
    Guid? CandidateRunId,
    bool NotTested = false)
{
    /// <summary>
    /// The A/B comparison could not be carried out — a run produced no (or incomplete) results,
    /// typically an unreachable/unauthorized provider or an upstream outage. The theory was
    /// neither proven nor disproven, so it must not settle as Invalidated.
    /// </summary>
    public static readonly TheoryValidationOutcome CouldNotTest = new(null, null, null, null, null, NotTested: true);

    /// <summary>A losing comparison: measurements recorded, but no proposal produced.</summary>
    public static TheoryValidationOutcome Rejected(double baseline, double projected, double? pValue, Guid candidateRunId)
        => new(null, baseline, projected, pValue, candidateRunId);

    /// <summary>A winning comparison: a proposal plus the measurements that justified it.</summary>
    public static TheoryValidationOutcome Won(IOptimizationProposal proposal, double baseline, double projected, double? pValue, Guid candidateRunId)
        => new(proposal, baseline, projected, pValue, candidateRunId);
}

/// <summary>
/// Invoked as soon as the candidate (changed agent) A/B run is created or resolved — before the
/// comparison finishes — so the in-flight run can be linked to the theory while it is still validating.
/// </summary>
internal delegate Task CandidateRunObserver(Guid candidateRunId, CancellationToken cancellationToken);

/// <summary>
/// Validates a single kind of <see cref="IOptimizationTheory"/> by grounding it against
/// a baseline and a candidate test run, returning a Draft proposal when the change improves
/// the agent, or null when it does not — alongside the measured A/B metrics.
/// </summary>
internal interface ITheoryValidator
{
    bool CanValidate(IOptimizationTheory theory);

    Task<TheoryValidationOutcome> ValidateAsync(
        IOptimizationTheory theory,
        CancellationToken cancellationToken = default,
        CandidateRunObserver? onCandidateRun = null);
}
