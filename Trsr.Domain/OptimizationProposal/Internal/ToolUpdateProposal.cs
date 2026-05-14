using System.ComponentModel.DataAnnotations;
using JetBrains.Annotations;
using Trsr.Common.Validation;
using Trsr.Domain.Agent;
using Trsr.Domain.Internal;
using Trsr.Domain.Proposal;
using Trsr.Domain.Tools;

namespace Trsr.Domain.OptimizationProposal.Internal;

[UsedImplicitly]
internal record ToolUpdateProposal : DomainEntity<IOptimizationProposal>, IToolUpdateProposal
{
    public IAgent Agent { get; }
    public ProposalKind Kind => ProposalKind.Tool;
    public ProposalStatus Status { get; }
    public Priority Priority { get; }
    public string Rationale { get; }
    public IReadOnlyList<ToolSpecification> ProposedTools { get; }
    public IReadOnlyCollection<Guid> EvidenceTestRunIds { get; }

    public ToolUpdateProposal(
        IAgent agent,
        Priority priority,
        string rationale,
        IReadOnlyList<ToolSpecification> proposedTools,
        IReadOnlyCollection<Guid> evidenceTestRunIds,
        IRepository<IOptimizationProposal> repository) : base(repository)
    {
        Agent = agent;
        Status = ProposalStatus.Draft;
        Priority = priority;
        Rationale = rationale;
        ProposedTools = proposedTools.ToArray();
        EvidenceTestRunIds = evidenceTestRunIds.ToArray();
    }

    public ToolUpdateProposal(
        IAgent agent,
        ProposalStatus status,
        Priority priority,
        string rationale,
        IReadOnlyList<ToolSpecification> proposedTools,
        IReadOnlyCollection<Guid> evidenceTestRunIds,
        IDomainEntityData existing,
        IRepository<IOptimizationProposal> repository) : base(existing, repository)
    {
        Agent = agent;
        Status = status;
        Priority = priority;
        Rationale = rationale;
        ProposedTools = proposedTools.ToArray();
        EvidenceTestRunIds = evidenceTestRunIds.ToArray();
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
            yield return result;

        foreach (var result in Agent.Validate(validationContext))
            yield return result;

        if (string.IsNullOrWhiteSpace(Rationale))
            yield return Validation.NotNullOrWhiteSpace(Rationale);
    }
}
