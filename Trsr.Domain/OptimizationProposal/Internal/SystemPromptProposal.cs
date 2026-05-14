using System.ComponentModel.DataAnnotations;
using JetBrains.Annotations;
using Trsr.Common.Validation;
using Trsr.Domain.Agent;
using Trsr.Domain.Internal;
using Trsr.Domain.Proposal;

namespace Trsr.Domain.OptimizationProposal.Internal;

[UsedImplicitly]
internal record SystemPromptProposal : DomainEntity<IOptimizationProposal>, ISystemPromptProposal
{
    public IAgent Agent { get; }
    public ProposalKind Kind => ProposalKind.SystemPrompt;
    public ProposalStatus Status { get; }
    public Priority Priority { get; }
    public string Rationale { get; }
    public string ProposedSystemMessage { get; }
    public IReadOnlyCollection<Guid> EvidenceTestRunIds { get; }

    public SystemPromptProposal(
        IAgent agent,
        Priority priority,
        string rationale,
        string proposedSystemMessage,
        IReadOnlyCollection<Guid> evidenceTestRunIds,
        IRepository<IOptimizationProposal> repository) : base(repository)
    {
        Agent = agent;
        Status = ProposalStatus.Draft;
        Priority = priority;
        Rationale = rationale;
        ProposedSystemMessage = proposedSystemMessage;
        EvidenceTestRunIds = evidenceTestRunIds.ToArray();
    }

    public SystemPromptProposal(
        IAgent agent,
        ProposalStatus status,
        Priority priority,
        string rationale,
        string proposedSystemMessage,
        IReadOnlyCollection<Guid> evidenceTestRunIds,
        IDomainEntityData existing,
        IRepository<IOptimizationProposal> repository) : base(existing, repository)
    {
        Agent = agent;
        Status = status;
        Priority = priority;
        Rationale = rationale;
        ProposedSystemMessage = proposedSystemMessage;
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

        if (string.IsNullOrWhiteSpace(ProposedSystemMessage))
            yield return Validation.NotNullOrWhiteSpace(ProposedSystemMessage);
    }
}
