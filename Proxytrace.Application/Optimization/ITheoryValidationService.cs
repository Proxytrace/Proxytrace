using Proxytrace.Domain.OptimizationTheory;

namespace Proxytrace.Application.Optimization;

/// <summary>
/// Outcome of submitting a theory to the validation pipeline.
/// </summary>
public enum TheorySubmissionOutcome
{
    /// <summary>The theory was accepted, persisted, and queued for validation.</summary>
    Accepted,

    /// <summary>An identical theory or proposal already exists; the submission was suppressed.</summary>
    Duplicate,

    /// <summary>The project's concurrent-validation quota is exhausted; try again later.</summary>
    QuotaExceeded,
}

/// <summary>
/// Result of a theory submission. <see cref="Theory"/> is populated only when
/// <see cref="Outcome"/> is <see cref="TheorySubmissionOutcome.Accepted"/>.
/// </summary>
public record TheorySubmissionResult(TheorySubmissionOutcome Outcome, IOptimizationTheory? Theory);

/// <summary>
/// Accepts optimization theories from any producer (built-in optimizers, users, Tracey AI,
/// external callers), deduplicates and rate-limits them, and validates each via an A/B run.
/// </summary>
public interface ITheoryValidationService
{
    /// <summary>
    /// Submits an unproven theory for validation. Returns immediately; validation runs in the background.
    /// </summary>
    Task<TheorySubmissionResult> SubmitAsync(IOptimizationTheory theory, CancellationToken cancellationToken = default);
}
