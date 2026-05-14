using System.ComponentModel.DataAnnotations;
using JetBrains.Annotations;
using Trsr.Common.Validation;
using Trsr.Domain.Agent;
using Trsr.Domain.Internal;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Proposal;

namespace Trsr.Domain.OptimizationProposal.Internal;

[UsedImplicitly]
internal record ModelSwitchProposal : DomainEntity<IOptimizationProposal>, IModelSwitchProposal
{
    public IAgent Agent { get; }
    public ProposalKind Kind => ProposalKind.ModelSwitch;
    public ProposalStatus Status { get; }
    public Priority Priority { get; }
    public string Rationale { get; }
    public IModelEndpoint ProposedEndpoint { get; }
    public double? ExpectedPassRateDelta { get; }
    public decimal? ExpectedCostDelta { get; }
    public TimeSpan? ExpectedLatencyDelta { get; }
    public IReadOnlyCollection<Guid> EvidenceTestRunIds { get; }

    public ModelSwitchProposal(
        IAgent agent,
        Priority priority,
        string rationale,
        IModelEndpoint proposedEndpoint,
        double? expectedPassRateDelta,
        decimal? expectedCostDelta,
        TimeSpan? expectedLatencyDelta,
        IReadOnlyCollection<Guid> evidenceTestRunIds,
        IRepository<IOptimizationProposal> repository) : base(repository)
    {
        Agent = agent;
        Status = ProposalStatus.Draft;
        Priority = priority;
        Rationale = rationale;
        ProposedEndpoint = proposedEndpoint;
        ExpectedPassRateDelta = expectedPassRateDelta;
        ExpectedCostDelta = expectedCostDelta;
        ExpectedLatencyDelta = expectedLatencyDelta;
        EvidenceTestRunIds = evidenceTestRunIds.ToArray();
    }

    public ModelSwitchProposal(
        IAgent agent,
        ProposalStatus status,
        Priority priority,
        string rationale,
        IModelEndpoint proposedEndpoint,
        double? expectedPassRateDelta,
        decimal? expectedCostDelta,
        TimeSpan? expectedLatencyDelta,
        IReadOnlyCollection<Guid> evidenceTestRunIds,
        IDomainEntityData existing,
        IRepository<IOptimizationProposal> repository) : base(existing, repository)
    {
        Agent = agent;
        Status = status;
        Priority = priority;
        Rationale = rationale;
        ProposedEndpoint = proposedEndpoint;
        ExpectedPassRateDelta = expectedPassRateDelta;
        ExpectedCostDelta = expectedCostDelta;
        ExpectedLatencyDelta = expectedLatencyDelta;
        EvidenceTestRunIds = evidenceTestRunIds.ToArray();
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
