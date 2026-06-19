using System.ComponentModel.DataAnnotations;
using Proxytrace.Common.Validation;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.Internal;
using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.Proposal;
using Proxytrace.Domain.TestSuite;

namespace Proxytrace.Domain.OptimizationTheory.Internal;

/// <summary>
/// Shared base for the concrete theory kinds. Holds the common hypothesis metadata
/// and the lifecycle state machine; each subtype contributes the proposed-change payload.
/// </summary>
internal abstract record OptimizationTheory : DomainEntity<IOptimizationTheory>, IOptimizationTheory
{
    public IAgent Agent { get; private init; }
    public ITestSuite Suite { get; private init; }
    public abstract ProposalKind Kind { get; }
    public TheoryStatus Status { get; private init; }
    public TheorySource Source { get; private init; }
    public Priority Priority { get; private init; }
    public string Rationale { get; private init; }
    public IReadOnlyCollection<Guid> EvidenceTestRunIds { get; private init; }
    public Guid? ResultingProposalId { get; private init; }
    public double? BaselinePassRate { get; private init; }
    public double? ProjectedPassRate { get; private init; }
    public double? PValue { get; private init; }
    public Guid? ABTestRunId { get; private init; }
    public string ContentHash { get; private init; }

    protected OptimizationTheory(
        IAgent agent,
        ITestSuite suite,
        TheorySource source,
        Priority priority,
        string rationale,
        IReadOnlyCollection<Guid> evidenceTestRunIds,
        string contentHash,
        IRepository<IOptimizationTheory> repository) : base(repository)
    {
        Agent = agent;
        Suite = suite;
        Status = TheoryStatus.Proposed;
        Source = source;
        Priority = priority;
        Rationale = rationale;
        EvidenceTestRunIds = evidenceTestRunIds.ToArray();
        ResultingProposalId = null;
        ContentHash = contentHash;
    }

    protected OptimizationTheory(
        IAgent agent,
        ITestSuite suite,
        TheoryStatus status,
        TheorySource source,
        Priority priority,
        string rationale,
        IReadOnlyCollection<Guid> evidenceTestRunIds,
        Guid? resultingProposalId,
        double? baselinePassRate,
        double? projectedPassRate,
        double? pValue,
        Guid? abTestRunId,
        string contentHash,
        IDomainEntityData existing,
        IRepository<IOptimizationTheory> repository) : base(existing, repository)
    {
        Agent = agent;
        Suite = suite;
        Status = status;
        Source = source;
        Priority = priority;
        Rationale = rationale;
        EvidenceTestRunIds = evidenceTestRunIds.ToArray();
        ResultingProposalId = resultingProposalId;
        BaselinePassRate = baselinePassRate;
        ProjectedPassRate = projectedPassRate;
        PValue = pValue;
        ABTestRunId = abTestRunId;
        ContentHash = contentHash;
    }

    public Task<IOptimizationTheory> SetValidating(CancellationToken cancellationToken = default)
    {
        if (Status != TheoryStatus.Proposed)
            throw new InvalidOperationException($"Cannot start validating theory {Id} from status {Status}.");

        return ApplyAsync(this with { Status = TheoryStatus.Validating }, cancellationToken);
    }

    public Task<IOptimizationTheory> AttachAbTestRun(Guid abTestRunId, CancellationToken cancellationToken = default)
    {
        if (Status != TheoryStatus.Validating)
            throw new InvalidOperationException($"Cannot attach an A/B run to theory {Id} from status {Status}.");

        return ApplyAsync(this with { ABTestRunId = abTestRunId }, cancellationToken);
    }

    public Task<IOptimizationTheory> SetValidated(
        Guid resultingProposalId,
        double? baselinePassRate,
        double? projectedPassRate,
        double? pValue,
        Guid? abTestRunId,
        CancellationToken cancellationToken = default)
    {
        if (Status != TheoryStatus.Validating)
            throw new InvalidOperationException($"Cannot validate theory {Id} from status {Status}.");

        return ApplyAsync(
            this with
            {
                Status = TheoryStatus.Validated,
                ResultingProposalId = resultingProposalId,
                BaselinePassRate = baselinePassRate,
                ProjectedPassRate = projectedPassRate,
                PValue = pValue,
                ABTestRunId = abTestRunId,
            },
            cancellationToken);
    }

    public Task<IOptimizationTheory> SetInvalidated(
        double? baselinePassRate,
        double? projectedPassRate,
        double? pValue,
        Guid? abTestRunId,
        CancellationToken cancellationToken = default)
    {
        if (Status != TheoryStatus.Validating)
            throw new InvalidOperationException($"Cannot invalidate theory {Id} from status {Status}.");

        return ApplyAsync(
            this with
            {
                Status = TheoryStatus.Invalidated,
                BaselinePassRate = baselinePassRate,
                ProjectedPassRate = projectedPassRate,
                PValue = pValue,
                ABTestRunId = abTestRunId,
            },
            cancellationToken);
    }

    public Task<IOptimizationTheory> ResetToProposed(CancellationToken cancellationToken = default)
    {
        if (Status is not (TheoryStatus.Validated or TheoryStatus.Invalidated))
            throw new InvalidOperationException($"Cannot reset theory {Id} to Proposed from status {Status}.");

        return ApplyAsync(
            this with
            {
                Status = TheoryStatus.Proposed,
                ResultingProposalId = null,
                BaselinePassRate = null,
                ProjectedPassRate = null,
                PValue = null,
                ABTestRunId = null,
            },
            cancellationToken);
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
            yield return result;

        foreach (var result in Agent.Validate(validationContext))
            yield return result;

        foreach (var result in Suite.Validate(validationContext))
            yield return result;

        if (string.IsNullOrWhiteSpace(Rationale))
            yield return Validation.NotNullOrWhiteSpace(Rationale);

        if (string.IsNullOrWhiteSpace(ContentHash))
            yield return Validation.NotNullOrWhiteSpace(ContentHash);
    }
}
