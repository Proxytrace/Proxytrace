using System.ComponentModel.DataAnnotations;
using JetBrains.Annotations;
using Proxytrace.Common.Validation;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.Internal;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.Proposal;
using Proxytrace.Domain.TestRun;

namespace Proxytrace.Domain.OptimizationProposal.Internal;

[UsedImplicitly]
internal record ModelSwitchProposal : DomainEntity<IOptimizationProposal>, IModelSwitchProposal
{
    public IAgent Agent { get; }
    public ProposalKind Kind => ProposalKind.ModelSwitch;
    public ProposalStatus Status { get; }
    public Priority Priority { get; }
    public string Rationale { get; }
    public ITestRun ABTestRun { get; }
    public IModelEndpoint ProposedEndpoint { get; }
    public double? CurrentPassRate { get; }
    public double? ProposedPassRate { get; }
    public decimal? ExpectedCostDelta { get; }
    public TimeSpan? ExpectedLatencyDelta { get; }
    public IReadOnlyCollection<Guid> EvidenceTestRunIds { get; }

    public ModelSwitchProposal(
        IAgent agent,
        Priority priority,
        string rationale,
        IModelEndpoint proposedEndpoint,
        double? currentPassRate,
        double? proposedPassRate,
        decimal? expectedCostDelta,
        TimeSpan? expectedLatencyDelta,
        IReadOnlyCollection<Guid> evidenceTestRunIds,
        ITestRun abTestRun,
        IRepository<IOptimizationProposal> repository) : base(repository)
    {
        Agent = agent;
        Status = ProposalStatus.Draft;
        Priority = priority;
        Rationale = rationale;
        ProposedEndpoint = proposedEndpoint;
        CurrentPassRate = currentPassRate;
        ProposedPassRate = proposedPassRate;
        ExpectedCostDelta = expectedCostDelta;
        ExpectedLatencyDelta = expectedLatencyDelta;
        EvidenceTestRunIds = evidenceTestRunIds.ToArray();
        ABTestRun = abTestRun;
    }

    public ModelSwitchProposal(
        IAgent agent,
        ProposalStatus status,
        Priority priority,
        string rationale,
        IModelEndpoint proposedEndpoint,
        double? currentPassRate,
        double? proposedPassRate,
        decimal? expectedCostDelta,
        TimeSpan? expectedLatencyDelta,
        IReadOnlyCollection<Guid> evidenceTestRunIds,
        ITestRun abTestRun,
        IDomainEntityData existing,
        IRepository<IOptimizationProposal> repository) : base(existing, repository)
    {
        Agent = agent;
        Status = status;
        Priority = priority;
        Rationale = rationale;
        ProposedEndpoint = proposedEndpoint;
        CurrentPassRate = currentPassRate;
        ProposedPassRate = proposedPassRate;
        ExpectedCostDelta = expectedCostDelta;
        ExpectedLatencyDelta = expectedLatencyDelta;
        EvidenceTestRunIds = evidenceTestRunIds.ToArray();
        ABTestRun = abTestRun;
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
            yield return result;

        foreach (var result in Agent.Validate(validationContext))
            yield return result;

        foreach (var result in ProposedEndpoint.Validate(validationContext))
            yield return result;

        if (string.IsNullOrWhiteSpace(Rationale))
            yield return Validation.NotNullOrWhiteSpace(Rationale);
    }
}
