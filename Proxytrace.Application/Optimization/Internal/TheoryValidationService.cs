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

    private async Task ValidateAsync(Guid theoryId, CancellationToken cancellationToken)
    {
        IOptimizationTheory? theory = await theories.FindAsync(theoryId, cancellationToken);
        if (theory is null)
        {
            logger.LogWarning("Theory {TheoryId} not found — skipping validation", theoryId);
            return;
        }

        try
        {
            theory = await theory.SetValidating(cancellationToken);
            theoryBroadcaster.Publish(TheoryStatusChangedEvent.Create(theory));

            var validator = validators.FirstOrDefault(v => v.CanValidate(theory));
            TheoryValidationOutcome outcome = validator is null
                ? TheoryValidationOutcome.Inconclusive
                : await validator.ValidateAsync(theory, cancellationToken);

            if (outcome.Proposal is { } proposal)
            {
                // Persist the proposal and mark the theory validated atomically — a crash between
                // the two writes would otherwise leave an orphaned Draft proposal that no theory
                // references. Broadcast only after the transaction commits.
                var (persisted, validated) = await transaction.InvokeAsync(async () =>
                {
                    var savedProposal = await proposals.AddAsync(proposal, cancellationToken);
                    var savedTheory = await theory.SetValidated(
                        savedProposal.Id, outcome.BaselinePassRate, outcome.ProjectedPassRate, outcome.PValue, cancellationToken);
                    return (savedProposal, savedTheory);
                });

                proposalBroadcaster.Publish(ProposalCreatedEvent.Create(persisted));
                theoryBroadcaster.Publish(TheoryStatusChangedEvent.Create(validated));
                logger.LogInformation("Theory {TheoryId} validated; produced proposal {ProposalId}", theoryId, persisted.Id);
            }
            else
            {
                theory = await theory.SetInvalidated(
                    outcome.BaselinePassRate, outcome.ProjectedPassRate, outcome.PValue, cancellationToken);
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
                theory = await theory.SetInvalidated(null, null, null, cancellationToken);
                theoryBroadcaster.Publish(TheoryStatusChangedEvent.Create(theory));
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to mark theory {TheoryId} as invalidated after error", theoryId);
        }
    }
}
