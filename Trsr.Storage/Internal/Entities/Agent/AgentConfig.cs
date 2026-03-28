using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Serialization;
using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Storage.Internal.Entities.Project;

namespace Trsr.Storage.Internal.Entities.Agent;

/// <summary>
/// Entity Framework configuration for <see cref="AgentEntity"/>
/// </summary>
internal class AgentConfig : AbstractEntityConfiguration<AgentEntity>, IMapper<IAgent, AgentEntity>
{
    private readonly IAgent.CreateExisting factory;
    private readonly ISerializer serializer;

    public AgentConfig(IAgent.CreateExisting factory, ISerializer serializer)
    {
        this.factory = factory;
        this.serializer = serializer;
    }

    /// <inheritdoc />
    public override void Configure(EntityTypeBuilder<AgentEntity> builder)
    {
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
    }

    public IAgent Map(AgentEntity storedEntity)
        => factory(storedEntity);

    public AgentEntity Map(IAgent domainEntity)
        => new()
        {
            Id = domainEntity.Id,
            Project = domainEntity.Project,
            SystemMessage = domainEntity.SystemMessage,
            CreatedAt = domainEntity.CreatedAt,
            UpdatedAt = domainEntity.UpdatedAt,
        };

    
}
