using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Agent;
using Trsr.Domain.Internal;
using Trsr.Domain.Proposal;

namespace Trsr.Domain.OptimizationProposal.Internal;

internal record OptimizationProposal : DomainEntity<IOptimizationProposal>, IOptimizationProposal
{
    public IAgent Agent { get; }
    public ProposalKind Kind => Details switch
    {
        ModelSwitchDetails => ProposalKind.ModelSwitch,
        SystemPromptDetails => ProposalKind.SystemPrompt,
        ToolDetails => ProposalKind.Tool,
        _ => throw new ArgumentOutOfRangeException(nameof(Details))
    };
    public ProposalStatus Status { get; }
    public Priority Priority { get; }
    public string Rationale { get; }
    public ProposalDetails Details { get; }
    public IReadOnlyCollection<Guid> EvidenceTestRunIds { get; }

    public OptimizationProposal(
        IAgent agent,
        Priority priority,
        string rationale,
        ProposalDetails details,
        IReadOnlyCollection<Guid> evidenceTestRunIds,
        IRepository<IOptimizationProposal> repository) : base(repository)
    {
        Agent = agent;
        Status = ProposalStatus.Draft;
        Priority = priority;
        Rationale = rationale;
        Details = details;
        EvidenceTestRunIds = evidenceTestRunIds.ToArray();
    }

    public OptimizationProposal(
        IAgent agent,
        ProposalStatus status,
        Priority priority,
        string rationale,
        ProposalDetails details,
        IReadOnlyCollection<Guid> evidenceTestRunIds,
        IDomainEntityData existing,
        IRepository<IOptimizationProposal> repository) : base(existing, repository)
    {
        Agent = agent;
        Status = status;
        Priority = priority;
        Rationale = rationale;
        Details = details;
        EvidenceTestRunIds = evidenceTestRunIds.ToArray();
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
            yield return result;

        foreach (var result in Agent.Validate(validationContext))
            yield return result;

        if (string.IsNullOrWhiteSpace(Rationale))
            foreach (var r in Validation.NotNullOrWhiteSpace(Rationale, nameof(Rationale)).AsEnumerable()) yield return r;
    }
}
