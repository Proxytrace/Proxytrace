using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Common.Serialization;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.OptimizationProposal;
using Trsr.Storage.Internal.Entities.Agent;

namespace Trsr.Storage.Internal.Entities.OptimizationProposal;

internal class OptimizationProposalConfig :
    AbstractEntityConfiguration<OptimizationProposalEntity>,
    IMapper<IOptimizationProposal, OptimizationProposalEntity>
{
    private readonly IOptimizationProposal.CreateExisting factory;
    private readonly ISerializer serializer;
    private readonly IRepository<IAgent> agents;

    public OptimizationProposalConfig(
        IOptimizationProposal.CreateExisting factory,
        ISerializer serializer,
        IRepository<IAgent> agents)
    {
        this.factory = factory;
        this.serializer = serializer;
        this.agents = agents;
    }

    public override void Configure(EntityTypeBuilder<OptimizationProposalEntity> builder)
    {
        builder
            .HasOne<AgentEntity>()
            .WithMany()
            .HasForeignKey(e => e.Agent)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => e.Agent);
        builder.HasIndex(e => e.Status);
        builder.HasIndex(e => e.Kind);
    }

    public async Task<IOptimizationProposal> Map(OptimizationProposalEntity stored, CancellationToken cancellationToken = default)
    {
        var agent = await agents.GetAsync(stored.Agent, cancellationToken);
        var evidenceTestRunIds = serializer.Deserialize<IReadOnlyCollection<Guid>>(stored.EvidenceTestRunIds)
                                 ?? Array.Empty<Guid>();

        ProposalDetails details = stored.Kind switch
        {
            ProposalKind.ModelSwitch => serializer.Deserialize<ModelSwitchDetails>(stored.Details)!,
            ProposalKind.SystemPrompt => serializer.Deserialize<SystemPromptDetails>(stored.Details)!,
            ProposalKind.Tool => serializer.Deserialize<ToolDetails>(stored.Details)!,
            _ => throw new ArgumentOutOfRangeException(nameof(stored.Kind))
        };

        return factory(
            agent: agent,
            status: stored.Status,
            priority: stored.Priority,
            rationale: stored.Rationale,
            details: details,
            evidenceTestRunIds: evidenceTestRunIds,
            existing: stored);
    }

    public Task<OptimizationProposalEntity> Map(IOptimizationProposal domain, CancellationToken cancellationToken = default)
        => new OptimizationProposalEntity
        {
            Id = domain.Id,
            Agent = domain.Agent.Id,
            Kind = domain.Kind,
            Status = domain.Status,
            Priority = domain.Priority,
            Rationale = domain.Rationale,
            Details = serializer.Serialize(domain.Details),
            EvidenceTestRunIds = serializer.Serialize(domain.EvidenceTestRunIds),
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}
