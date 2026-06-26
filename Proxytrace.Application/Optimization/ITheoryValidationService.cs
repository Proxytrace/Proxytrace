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
/// Outcome of resetting a theory back to the Proposed state for re-validation.
/// </summary>
public enum TheoryResetOutcome
{
    /// <summary>The theory was reset, any spawned proposal deleted, and the theory re-queued.</summary>
    Reset,

    /// <summary>No theory exists with the given id.</summary>
    NotFound,

    /// <summary>The theory is not in a terminal state (Validated/Invalidated), so it cannot be reset.</summary>
    NotResettable,

    /// <summary>The spawned proposal was already accepted (applied to the agent); reset is refused.</summary>
    BlockedByAcceptedProposal,
}

/// <summary>
/// Result of a theory reset. <see cref="Theory"/> is populated only when
/// <see cref="Outcome"/> is <see cref="TheoryResetOutcome.Reset"/>.
/// </summary>
public record TheoryResetResult(TheoryResetOutcome Outcome, IOptimizationTheory? Theory);

/// <summary>
/// Outcome of rejecting (dismissing/cancelling) an active theory.
/// </summary>
public enum TheoryRejectOutcome
{
    /// <summary>The theory was dismissed to Invalidated; any in-flight A/B run was cancelled.</summary>
    Rejected,

    /// <summary>No theory exists with the given id.</summary>
    NotFound,

    /// <summary>The theory is already terminal (Validated/Invalidated); there is nothing to reject.</summary>
    NotActive,
}

/// <summary>
/// Result of a theory rejection. <see cref="Theory"/> is populated only when
/// <see cref="Outcome"/> is <see cref="TheoryRejectOutcome.Rejected"/>.
/// </summary>
public record TheoryRejectResult(TheoryRejectOutcome Outcome, IOptimizationTheory? Theory);

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

    /// <summary>
    /// Resets a terminal theory back to Proposed: deletes any proposal it spawned (unless that proposal
    /// was already accepted) and re-queues the theory for a fresh A/B validation. Returns immediately;
    /// re-validation runs in the background.
    /// </summary>
    Task<TheoryResetResult> ResetToProposedAsync(Guid theoryId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Dismisses an active theory at the user's request: a Proposed theory is rejected without ever
    /// running A/B validation; a Validating theory has its in-flight A/B run cancelled. Either way the
    /// theory transitions to Invalidated. Returns <see cref="TheoryRejectOutcome.NotActive"/> for an
    /// already-terminal theory.
    /// </summary>
    Task<TheoryRejectResult> RejectAsync(Guid theoryId, CancellationToken cancellationToken = default);
}
