using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Common.Serialization;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Domain.Project;
using Trsr.Domain.Tools;
using Trsr.Storage.Internal.Entities.Project;

namespace Trsr.Storage.Internal.Entities.Agent;

internal class AgentConfig : AbstractEntityConfiguration<AgentEntity>, IMapper<IAgent, AgentEntity>
{
    private readonly IAgent.CreateExisting factory;
    private readonly ISerializer serializer;
    private readonly Lazy<IAgentRepository> repository;
    private readonly IRepository<IProject> projects;

    public AgentConfig(
        IAgent.CreateExisting factory,
        ISerializer serializer,
        Lazy<IAgentRepository> repository,
        IRepository<IProject> projects)
    {
        this.factory = factory;
        this.serializer = serializer;
        this.repository = repository;
        this.projects = projects;
    }

    public override void Configure(EntityTypeBuilder<AgentEntity> builder)
    {
        builder.HasIndex(e => e.Fingerprint).IsUnique();
        builder.Property(e => e.Fingerprint).HasMaxLength(64);

        builder
            .HasOne<ProjectEntity>()
            .WithMany()
            .HasForeignKey(e => e.Project)
            .OnDelete(DeleteBehavior.Restrict);

        builder
            .Property(e => e.SystemMessage)
            .HasConversion(
                v => serializer.Serialize(v),
                v => serializer.Deserialize<SystemMessage>(v)!
            );

        builder
            .Property(e => e.Tools)
            .HasConversion(
                v => serializer.Serialize(v),
                v => serializer.Deserialize<IReadOnlyCollection<ToolSpecification>>(v) ?? Array.Empty<ToolSpecification>()
            );
    }

    public async Task<IAgent> Map(AgentEntity stored, CancellationToken cancellationToken = default)
    {
        var project = await projects.GetAsync(stored.Project, cancellationToken);
        return factory(project, stored.SystemMessage, stored.Tools, stored);
    }

    public Task<AgentEntity> Map(IAgent domain, CancellationToken cancellationToken = default)
        => new AgentEntity
        {
            Id = domain.Id,
            Project = domain.Project.Id,
            Fingerprint = repository.Value.GetAgentFingerprint(domain),
            SystemMessage = domain.SystemMessage,
            Tools = domain.Tools,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}
