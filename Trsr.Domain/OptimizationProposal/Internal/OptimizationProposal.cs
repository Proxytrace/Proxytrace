using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Agent;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.Tools;

namespace Trsr.Domain.OptimizationProposal.Internal;

internal record OptimizationProposal : DomainEntity<IOptimizationProposal>, IOptimizationProposal
{
    public IAgent Agent { get; }
    public ProposalKind Kind { get; }
    public ProposalStatus Status { get; }
    public string Rationale { get; }
    public SystemMessage? ProposedSystemMessage { get; }
    public IReadOnlyCollection<ToolSpecification> ProposedTools { get; }
    public IReadOnlyCollection<Guid> EvidenceTestRunIds { get; }

    public OptimizationProposal(
        IAgent agent,
        ProposalKind kind,
        string rationale,
        SystemMessage? proposedSystemMessage,
        IReadOnlyCollection<ToolSpecification> proposedTools,
        IReadOnlyCollection<Guid> evidenceTestRunIds,
        IRepository<IOptimizationProposal> repository) : base(repository)
    {
        Agent = agent;
        Kind = kind;
        Status = ProposalStatus.Draft;
        Rationale = rationale;
        ProposedSystemMessage = proposedSystemMessage;
        ProposedTools = proposedTools.ToArray();
        EvidenceTestRunIds = evidenceTestRunIds.ToArray();
    }

    public OptimizationProposal(
        IAgent agent,
        ProposalKind kind,
        ProposalStatus status,
        string rationale,
        SystemMessage? proposedSystemMessage,
        IReadOnlyCollection<ToolSpecification> proposedTools,
        IReadOnlyCollection<Guid> evidenceTestRunIds,
        IDomainEntityData existing,
        IRepository<IOptimizationProposal> repository) : base(existing, repository)
    {
        Agent = agent;
        Kind = kind;
        Status = status;
        Rationale = rationale;
        ProposedSystemMessage = proposedSystemMessage;
        ProposedTools = proposedTools.ToArray();
        EvidenceTestRunIds = evidenceTestRunIds.ToArray();
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        if (Agent is null)
        {
            yield return Validation.NotNull(Agent, nameof(Agent));
        }
        else
        {
            foreach (var result in Agent.Validate(validationContext))
            {
                yield return result;
            }
        }

        if (string.IsNullOrWhiteSpace(Rationale))
        {
            yield return Validation.NotNullOrWhiteSpace(Rationale, nameof(Rationale));
        }

        if (ProposedTools is null)
        {
            yield return Validation.NotNull(ProposedTools, nameof(ProposedTools));
        }

        if (EvidenceTestRunIds is null)
        {
            yield return Validation.NotNull(EvidenceTestRunIds, nameof(EvidenceTestRunIds));
        }

        if (Kind is ProposalKind.SystemPrompt or ProposalKind.Both && ProposedSystemMessage is null)
        {
            yield return new ValidationResult(
                $"{nameof(ProposedSystemMessage)} must be set when {nameof(Kind)} is {Kind}.",
                [nameof(ProposedSystemMessage)]);
        }
    }
}
