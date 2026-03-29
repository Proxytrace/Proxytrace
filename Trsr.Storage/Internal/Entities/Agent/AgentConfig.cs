using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Serialization;
using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Domain.Tools;
using Trsr.Storage.Internal.Entities.Project;

namespace Trsr.Storage.Internal.Entities.Agent;

/// <summary>
/// Entity Framework configuration for <see cref="AgentEntity"/>
/// </summary>
internal class AgentConfig : AbstractEntityConfiguration<AgentEntity>, IMapper<IAgent, AgentEntity>
{
    private readonly IAgent.CreateExisting factory;
    private readonly ISerializer serializer;
    private readonly Lazy<IAgentRepository> repository;

    public AgentConfig(IAgent.CreateExisting factory, ISerializer serializer, Lazy<IAgentRepository> repository)
    {
        this.factory = factory;
        this.serializer = serializer;
        this.repository = repository;
    }

    /// <inheritdoc />
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

    public IAgent Map(AgentEntity storedEntity)
        => factory(storedEntity);

    public AgentEntity Map(IAgent domainEntity)
        => new()
        {
            Id = domainEntity.Id,
            Project = domainEntity.Project,
            Fingerprint = repository.Value.GetAgentFingerprint(domainEntity),
            SystemMessage = domainEntity.SystemMessage,
            Tools = domainEntity.Tools,
            CreatedAt = domainEntity.CreatedAt,
            UpdatedAt = domainEntity.UpdatedAt,
        };
}
