using System.ComponentModel.DataAnnotations;
using JetBrains.Annotations;
using Proxytrace.Common.Serialization;
using Proxytrace.Common.Validation;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentVersion;
using Proxytrace.Domain.Internal;
using Proxytrace.Domain.Proposal;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.Tools;

namespace Proxytrace.Domain.OptimizationProposal.Internal;

[UsedImplicitly]
internal record ToolUpdateProposal : DomainEntity<IOptimizationProposal>, IToolUpdateProposal
{
    public IAgent Agent { get; }
    public ProposalKind Kind => ProposalKind.Tool;
    public ProposalStatus Status { get; private init; }
    public Priority Priority { get; }
    public string Rationale { get; }
    public ITestRun ABTestRun { get; }
    public IReadOnlyList<ToolSpecification> ProposedTools { get; }
    public double? CurrentPassRate { get; }
    public double? ProposedPassRate { get; }
    public IReadOnlyCollection<Guid> EvidenceTestRunIds { get; }
    public string ContentHash { get; }
    public DateTimeOffset? AdoptedAt { get; private init; }
    public Guid? AdoptedAgentVersionId { get; private init; }
    public int? AdoptedAgentVersionNumber { get; private init; }
    public bool? AdoptedManually { get; private init; }

    public ToolUpdateProposal(
        IAgent agent,
        Priority priority,
        string rationale,
        IReadOnlyList<ToolSpecification> proposedTools,
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
        ProposedTools = proposedTools.ToArray();
        CurrentPassRate = currentPassRate;
        ProposedPassRate = proposedPassRate;
        EvidenceTestRunIds = evidenceTestRunIds.ToArray();
        ABTestRun = abTestRun;
        ContentHash = OptimizationContentHash.ForTools(serializer, agent.Id, proposedTools);
    }

    public ToolUpdateProposal(
        IAgent agent,
        ProposalStatus status,
        Priority priority,
        string rationale,
        IReadOnlyList<ToolSpecification> proposedTools,
        double? currentPassRate,
        double? proposedPassRate,
        IReadOnlyCollection<Guid> evidenceTestRunIds,
        ITestRun abTestRun,
        string contentHash,
        DateTimeOffset? adoptedAt,
        Guid? adoptedAgentVersionId,
        int? adoptedAgentVersionNumber,
        bool? adoptedManually,
        IDomainEntityData existing,
        IRepository<IOptimizationProposal> repository) : base(existing, repository)
    {
        Agent = agent;
        Status = status;
        Priority = priority;
        Rationale = rationale;
        ProposedTools = proposedTools.ToArray();
        CurrentPassRate = currentPassRate;
        ProposedPassRate = proposedPassRate;
        EvidenceTestRunIds = evidenceTestRunIds.ToArray();
        ABTestRun = abTestRun;
        ContentHash = contentHash;
        AdoptedAt = adoptedAt;
        AdoptedAgentVersionId = adoptedAgentVersionId;
        AdoptedAgentVersionNumber = adoptedAgentVersionNumber;
        AdoptedManually = adoptedManually;
    }

    public Task<IOptimizationProposal> Accept(CancellationToken cancellationToken = default)
    {
        if (Status != ProposalStatus.Draft)
            throw new InvalidOperationException($"Cannot accept proposal {Id} from status {Status}.");

        return ApplyAsync(this with { Status = ProposalStatus.Accepted }, cancellationToken);
    }

    public Task<IOptimizationProposal> Reject(CancellationToken cancellationToken = default)
    {
        if (Status != ProposalStatus.Draft)
            throw new InvalidOperationException($"Cannot reject proposal {Id} from status {Status}.");

        return ApplyAsync(this with { Status = ProposalStatus.Rejected }, cancellationToken);
    }

    public Task<IOptimizationProposal> MarkAdopted(
        IAgentVersion? adoptedVersion,
        bool manual,
        CancellationToken cancellationToken = default)
    {
        if (Status != ProposalStatus.Accepted)
            throw new InvalidOperationException($"Cannot mark proposal {Id} adopted from status {Status}.");

        return ApplyAsync(
            this with
            {
                Status = ProposalStatus.Adopted,
                AdoptedAt = DateTimeOffset.UtcNow,
                AdoptedAgentVersionId = adoptedVersion?.Id,
                AdoptedAgentVersionNumber = adoptedVersion?.VersionNumber,
                AdoptedManually = manual,
            },
            cancellationToken);
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
            yield return result;

        foreach (var result in Agent.Validate(validationContext))
            yield return result;

        if (string.IsNullOrWhiteSpace(Rationale))
            yield return Validation.NotNullOrWhiteSpace(Rationale);

        if (Status == ProposalStatus.Adopted)
        {
            yield return Validation.NotNull(AdoptedAt);
            yield return Validation.NotNull(AdoptedManually);

            if (AdoptedAt is { } adoptedAt)
            {
                yield return Validation.InPast(adoptedAt, nameof(AdoptedAt));
                yield return Validation.NotBefore(adoptedAt, CreatedAt, nameof(AdoptedAt));
            }
        }
        else
        {
            yield return Validation.Null(AdoptedAt);
            yield return Validation.Null(AdoptedAgentVersionId);
            yield return Validation.Null(AdoptedAgentVersionNumber);
            yield return Validation.Null(AdoptedManually);
        }
    }
}
