using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Domain.Project;
using Trsr.Storage.Internal.Entities.Organization;

namespace Trsr.Storage.Internal.Entities.Project;

/// <summary>
/// Entity Framework configuration for <see cref="ProjectEntity"/>
/// </summary>
internal class ProjectConfig : AbstractEntityConfiguration<ProjectEntity>, IMapper<IProject, ProjectEntity>
{
    private readonly IProject.CreateExisting factory;

    public ProjectConfig(IProject.CreateExisting factory)
    {
        this.factory = factory;
    }
    
    /// <inheritdoc />
    public override void Configure(EntityTypeBuilder<ProjectEntity> builder)
    {
        builder
            .HasIndex(e => new { e.Name, e.Organization })
            .IsUnique();
        
        // Foreign key relationship to Organization
        builder
            .HasOne<OrganizationEntity>()
            .WithMany()
            .HasForeignKey(e => e.Organization)
            .OnDelete(DeleteBehavior.Restrict);
    }

    public IProject Map(ProjectEntity storedEntity)
        => factory(storedEntity);

    public ProjectEntity Map(IProject domainEntity)
        => new()
        {
            Id = domainEntity.Id,
            Name = domainEntity.Name,
            Organization = domainEntity.Organization,
            CreatedAt = domainEntity.CreatedAt,
            UpdatedAt = domainEntity.UpdatedAt,
        };
}

