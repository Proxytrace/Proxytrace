using System.Threading.Channels;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Proxytrace.Application.Optimization.Internal.Validation;
using Proxytrace.Application.Streaming;
using Proxytrace.Domain;
using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.OptimizationTheory;
using Proxytrace.Domain.TestRunGroup;

namespace Proxytrace.Application.Optimization.Internal;

/// <summary>
/// Background pipeline that grounds submitted theories. Submission deduplicates and
/// rate-limits; the worker loop runs the kind-specific validator and, on a winning A/B
/// comparison, spawns a Draft <see cref="IOptimizationProposal"/>.
/// </summary>
internal sealed class TheoryValidationService : BackgroundService, ITheoryValidationService
{
    /// <summary>
    /// Number of completed test-run groups against the agent that must occur after a
    /// Rejected/Accepted decision before an identical theory is allowed to resurface.
    /// </summary>
    public const int ResurfaceThreshold = 3;

    /// <summary>
    /// Maximum number of in-flight theories (queued or validating) a single project may have at once.
    /// Because validation is serial, the queue — not the validating set — is what actually grows, so the
    /// quota is checked against the whole backlog to bound the LLM spend an open submission endpoint can trigger.
    /// </summary>
    public const int MaxInFlightPerProject = 20;

    private readonly IOptimizationTheoryRepository theories;
    private readonly IOptimizationProposalRepository proposals;
    private readonly ITestRunGroupRepository testRunGroups;
    private readonly IEnumerable<ITheoryValidator> validators;
    private readonly IProposalBroadcaster proposalBroadcaster;
    private readonly ITheoryBroadcaster theoryBroadcaster;
    private readonly ITransaction transaction;
    private readonly ILogger<TheoryValidationService> logger;

    private readonly Channel<Guid> channel = Channel.CreateUnbounded<Guid>(
        new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false,
        });

    public TheoryValidationService(
        IOptimizationTheoryRepository theories,
        IOptimizationProposalRepository proposals,
        ITestRunGroupRepository testRunGroups,
        IEnumerable<ITheoryValidator> validators,
        IProposalBroadcaster proposalBroadcaster,
        ITheoryBroadcaster theoryBroadcaster,
        ITransaction transaction,
        ILogger<TheoryValidationService> logger)
    {
        this.theories = theories;
        this.proposals = proposals;
        this.testRunGroups = testRunGroups;
        this.validators = validators;
        this.proposalBroadcaster = proposalBroadcaster;
        this.theoryBroadcaster = theoryBroadcaster;
        this.transaction = transaction;
        this.logger = logger;
    }

    public async Task<TheorySubmissionResult> SubmitAsync(IOptimizationTheory theory, CancellationToken cancellationToken = default)
    {
        var inFlight = await theories.CountActiveByProjectAsync(
            theory.Agent.Project.Id, cancellationToken);
        if (inFlight >= MaxInFlightPerProject)
        {
            return new TheorySubmissionResult(TheorySubmissionOutcome.QuotaExceeded, null);
        }

        if (await ShouldSuppressAsync(theory, cancellationToken))
        {
            return new TheorySubmissionResult(TheorySubmissionOutcome.Duplicate, null);
        }

        var persisted = await theories.AddAsync(theory, cancellationToken);
        theoryBroadcaster.Publish(TheoryStatusChangedEvent.Create(persisted));
        await channel.Writer.WriteAsync(persisted.Id, cancellationToken);

        return new TheorySubmissionResult(TheorySubmissionOutcome.Accepted, persisted);
    }

    public async Task<TheoryResetResult> ResetToProposedAsync(Guid theoryId, CancellationToken cancellationToken = default)
    {
        var theory = await theories.FindAsync(theoryId, cancellationToken);
        if (theory is null)
            return new TheoryResetResult(TheoryResetOutcome.NotFound, null);

        if (theory.Status is not (TheoryStatus.Validated or TheoryStatus.Invalidated))
            return new TheoryResetResult(TheoryResetOutcome.NotResettable, null);

        var proposalId = theory.ResultingProposalId;
        if (proposalId is { } id)
        {
            var proposal = await proposals.FindAsync(id, cancellationToken);
            if (proposal is { Status: ProposalStatus.Accepted })
                return new TheoryResetResult(TheoryResetOutcome.BlockedByAcceptedProposal, null);
        }

        // Clear the theory's proposal reference before deleting the proposal so the two writes
        // stay consistent if interrupted; both happen in one transaction.
        var reset = await transaction.InvokeAsync(async () =>
        {
            var resetTheory = await theory.ResetToProposed(cancellationToken);
            if (proposalId is { } pid)
                await proposals.RemoveAsync(pid, cancellationToken);
            return resetTheory;
        });

        theoryBroadcaster.Publish(TheoryStatusChangedEvent.Create(reset));
        await channel.Writer.WriteAsync(reset.Id, cancellationToken);

        return new TheoryResetResult(TheoryResetOutcome.Reset, reset);
    }

    private async Task<bool> ShouldSuppressAsync(IOptimizationTheory theory, CancellationToken cancellationToken)
    {
        var priorTheory = await theories.FindLatestByContentHashAsync(
            theory.Agent.Id, theory.ContentHash, cancellationToken);

        // An identical theory is already pending, validating, or has already produced a proposal.
        if (priorTheory is not null && priorTheory.Status != TheoryStatus.Invalidated)
        {
            return true;
        }

        var priorProposal = await proposals.FindLatestByContentHashAsync(
            theory.Agent.Id, theory.ContentHash, cancellationToken);

        if (priorProposal is null)
        {
            return false;
        }

        // An identical proposal is already pending review — skip the duplicate.
        if (priorProposal.Status == ProposalStatus.Draft)
        {
            return true;
        }

        // Accepted or Rejected: suppress until enough new completed groups have run since the decision.
        var completedSince = await testRunGroups.CountCompletedSinceAsync(
            theory.Agent.Id, priorProposal.UpdatedAt, cancellationToken);

        return completedSince < ResurfaceThreshold;
    }

    protected override async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        try
        {
            await RecoverInFlightTheoriesAsync(cancellationToken);

            await foreach (var theoryId in channel.Reader.ReadAllAsync(cancellationToken))
            {
                await ValidateAsync(theoryId, cancellationToken);
            }
        }
        catch (OperationCanceledException)
        {
            // graceful shutdown
        }
    }

    /// <summary>
    /// Re-queues theories that were Proposed or Validating when the process last stopped.
    /// The validation queue is in-memory, so without this the backlog would be stranded —
    /// never validated, yet permanently counted against the per-project submission quota.
    /// </summary>
    private async Task RecoverInFlightTheoriesAsync(CancellationToken cancellationToken)
    {
        try
        {
            var active = await theories.GetActiveAsync(cancellationToken);
            foreach (var theory in active)
            {
                await channel.Writer.WriteAsync(theory.Id, cancellationToken);
            }

            if (active.Count > 0)
                logger.LogInformation("Re-queued {Count} in-flight theory/theories after restart", active.Count);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to recover in-flight theories after restart");
        }
    }

    private async Task ValidateAsync(Guid theoryId, CancellationToken cancellationToken)
    {
        IOptimizationTheory? theory = await theories.FindAsync(theoryId, cancellationToken);
        if (theory is null)
        {
            logger.LogWarning("Theory {TheoryId} not found — skipping validation", theoryId);
            return;
        }

        if (theory.Status is TheoryStatus.Validated or TheoryStatus.Invalidated)
        {
            // Already settled — e.g. a theory submitted while restart recovery was re-queuing
            // the backlog can be enqueued twice.
            return;
        }

        try
        {
            // A recovered theory may already be Validating from before the restart.
            if (theory.Status == TheoryStatus.Proposed)
            {
                theory = await theory.SetValidating(cancellationToken);
                theoryBroadcaster.Publish(TheoryStatusChangedEvent.Create(theory));
            }

            // Link the candidate A/B run to the theory the moment it is created — while still
            // Validating — so reviewers can watch the in-flight run, not just the finished one.
            async Task OnCandidateRun(Guid candidateRunId, CancellationToken ct)
            {
                if (theory is null)
                    return;
                theory = await theory.AttachAbTestRun(candidateRunId, ct);
                theoryBroadcaster.Publish(TheoryStatusChangedEvent.Create(theory));
            }

            var validator = validators.FirstOrDefault(v => v.CanValidate(theory));
            TheoryValidationOutcome outcome = validator is null
                ? TheoryValidationOutcome.Inconclusive
                : await validator.ValidateAsync(theory, cancellationToken, OnCandidateRun);

            if (outcome.Proposal is { } proposal)
            {
                // Persist the proposal and mark the theory validated atomically — a crash between
                // the two writes would otherwise leave an orphaned Draft proposal that no theory
                // references. Broadcast only after the transaction commits.
                var (persisted, validated) = await transaction.InvokeAsync(async () =>
                {
                    var savedProposal = await proposals.AddAsync(proposal, cancellationToken);
                    var savedTheory = await theory.SetValidated(
                        savedProposal.Id, outcome.BaselinePassRate, outcome.ProjectedPassRate, outcome.PValue,
                        outcome.CandidateRunId ?? theory.ABTestRunId, cancellationToken);
                    return (savedProposal, savedTheory);
                });

                proposalBroadcaster.Publish(ProposalCreatedEvent.Create(persisted));
                theoryBroadcaster.Publish(TheoryStatusChangedEvent.Create(validated));
                logger.LogInformation("Theory {TheoryId} validated; produced proposal {ProposalId}", theoryId, persisted.Id);
            }
            else
            {
                // Inconclusive outcomes carry no run id, but the observer may already have linked the
                // candidate run while validating — never downgrade a known link back to null.
                theory = await theory.SetInvalidated(
                    outcome.BaselinePassRate, outcome.ProjectedPassRate, outcome.PValue,
                    outcome.CandidateRunId ?? theory.ABTestRunId, cancellationToken);
                theoryBroadcaster.Publish(TheoryStatusChangedEvent.Create(theory));
                logger.LogInformation("Theory {TheoryId} invalidated — no improvement", theoryId);
            }
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            // individual job cancelled — continue processing
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Validation failed for theory {TheoryId}", theoryId);
            await TryInvalidateAsync(theoryId, cancellationToken);
        }
    }

    private async Task TryInvalidateAsync(Guid theoryId, CancellationToken cancellationToken)
    {
        try
        {
            var theory = await theories.FindAsync(theoryId, cancellationToken);
            if (theory is { Status: TheoryStatus.Validating })
            {
                // Preserve any A/B run already linked while validating; only the metrics are unknown.
                theory = await theory.SetInvalidated(null, null, null, theory.ABTestRunId, cancellationToken);
                theoryBroadcaster.Publish(TheoryStatusChangedEvent.Create(theory));
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to mark theory {TheoryId} as invalidated after error", theoryId);
        }
    }
}
