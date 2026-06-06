using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.OptimizationTheory;

namespace Proxytrace.Application.Optimization.Internal.Validation;

/// <summary>
/// Result of grounding a theory against a baseline and a candidate A/B run. The metrics are
/// recorded on the theory regardless of outcome; <see cref="Proposal"/> is non-null only when
/// the change improved the agent enough to spawn a Draft proposal.
/// </summary>
internal readonly record struct TheoryValidationOutcome(
    IOptimizationProposal? Proposal,
    double? BaselinePassRate,
    double? ProjectedPassRate,
    double? PValue)
{
    /// <summary>Outcome carrying no measurements — e.g. a run produced no results.</summary>
    public static readonly TheoryValidationOutcome Inconclusive = new(null, null, null, null);

    /// <summary>A losing comparison: measurements recorded, but no proposal produced.</summary>
    public static TheoryValidationOutcome Rejected(double baseline, double projected, double? pValue)
        => new(null, baseline, projected, pValue);

    /// <summary>A winning comparison: a proposal plus the measurements that justified it.</summary>
    public static TheoryValidationOutcome Won(IOptimizationProposal proposal, double baseline, double projected, double? pValue)
        => new(proposal, baseline, projected, pValue);
}

/// <summary>
/// Validates a single kind of <see cref="IOptimizationTheory"/> by grounding it against
/// a baseline and a candidate test run, returning a Draft proposal when the change improves
/// the agent, or null when it does not — alongside the measured A/B metrics.
/// </summary>
internal interface ITheoryValidator
{
    bool CanValidate(IOptimizationTheory theory);

    Task<TheoryValidationOutcome> ValidateAsync(IOptimizationTheory theory, CancellationToken cancellationToken = default);
}
