using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Common.Serialization;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.Tools;
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
    }

    public async Task<IOptimizationProposal> Map(OptimizationProposalEntity stored, CancellationToken cancellationToken = default)
    {
        var agent = await agents.GetAsync(stored.Agent, cancellationToken);
        var proposedSystemMessage = stored.ProposedSystemMessage is null
            ? null
            : serializer.Deserialize<SystemMessage>(stored.ProposedSystemMessage);
        var proposedTools = serializer.Deserialize<IReadOnlyCollection<ToolSpecification>>(stored.ProposedTools)
                            ?? Array.Empty<ToolSpecification>();
        var evidenceTestRunIds = serializer.Deserialize<IReadOnlyCollection<Guid>>(stored.EvidenceTestRunIds)
                                 ?? Array.Empty<Guid>();

        return factory(
            agent: agent,
            kind: stored.Kind,
            status: stored.Status,
            rationale: stored.Rationale,
            proposedSystemMessage: proposedSystemMessage,
            proposedTools: proposedTools,
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
            Rationale = domain.Rationale,
            ProposedSystemMessage = domain.ProposedSystemMessage is null
                ? null
                : serializer.Serialize(domain.ProposedSystemMessage),
            ProposedTools = serializer.Serialize(domain.ProposedTools),
            EvidenceTestRunIds = serializer.Serialize(domain.EvidenceTestRunIds),
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}
