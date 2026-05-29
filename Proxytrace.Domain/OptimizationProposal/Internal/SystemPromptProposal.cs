using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Text;
using JetBrains.Annotations;
using Proxytrace.Common.Serialization;
using Proxytrace.Common.Validation;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.Internal;
using Proxytrace.Domain.Proposal;
using Proxytrace.Domain.TestRun;

namespace Proxytrace.Domain.OptimizationProposal.Internal;

[UsedImplicitly]
internal record SystemPromptProposal : DomainEntity<IOptimizationProposal>, ISystemPromptProposal
{
    public IAgent Agent { get; }
    public ProposalKind Kind => ProposalKind.SystemPrompt;
    public ProposalStatus Status { get; }
    public Priority Priority { get; }
    public string Rationale { get; }
    public ITestRun ABTestRun { get; }
    public string ProposedSystemMessage { get; }
    public double? CurrentPassRate { get; }
    public double? ProposedPassRate { get; }
    public IReadOnlyCollection<Guid> EvidenceTestRunIds { get; }
    public string ContentHash { get; }

    public SystemPromptProposal(
        IAgent agent,
        Priority priority,
        string rationale,
        string proposedSystemMessage,
        double? currentPassRate,
        double? proposedPassRate,
        IReadOnlyCollection<Guid> evidenceTestRunIds,
        ITestRun abTestRun,
        ISerializer serializer,
        IRepository<IOptimizationProposal> repository) : base(repository)
    {
        Agent = agent;
        Status = ProposalStatus.Draft;
        Priority = priority;
        Rationale = rationale;
        ProposedSystemMessage = proposedSystemMessage;
        CurrentPassRate = currentPassRate;
        ProposedPassRate = proposedPassRate;
        EvidenceTestRunIds = evidenceTestRunIds.ToArray();
        ABTestRun = abTestRun;
        ContentHash = ComputeContentHash(serializer);
    }

    private string ComputeContentHash(ISerializer serializer)
    {
        var envelope = new
        {
            Agent = Agent.Id,
            Kind,
            Payload = new { Message = NormalizeText(ProposedSystemMessage) },
        };
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(serializer.Serialize(envelope)));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private string NormalizeText(string value)
        => value.Replace("\r\n", "\n").Replace("\r", "\n").Trim();

    public SystemPromptProposal(
        IAgent agent,
        ProposalStatus status,
        Priority priority,
        string rationale,
        string proposedSystemMessage,
        double? currentPassRate,
        double? proposedPassRate,
        IReadOnlyCollection<Guid> evidenceTestRunIds,
        ITestRun abTestRun,
        string contentHash,
        IDomainEntityData existing,
        IRepository<IOptimizationProposal> repository) : base(existing, repository)
    {
        Agent = agent;
        Status = status;
        Priority = priority;
        Rationale = rationale;
        ProposedSystemMessage = proposedSystemMessage;
        CurrentPassRate = currentPassRate;
        ProposedPassRate = proposedPassRate;
        EvidenceTestRunIds = evidenceTestRunIds.ToArray();
        ABTestRun = abTestRun;
        ContentHash = contentHash;
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