using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Domain.Organization;

namespace Trsr.Storage.Internal.Entities.Organization;

/// <summary>
/// Entity Framework configuration for <see cref="OrganizationEntity"/>
/// </summary>
internal class OrganizationConfig : AbstractEntityConfiguration<OrganizationEntity>, IMapper<IOrganization, OrganizationEntity>
{
    private readonly IOrganization.CreateExisting factory;

    public OrganizationConfig(IOrganization.CreateExisting factory)
    {
        this.factory = factory;
    }
    
    /// <inheritdoc />
    public override void Configure(EntityTypeBuilder<OrganizationEntity> builder)
    {
        builder
            .HasIndex(e => new { e.Name })
            .IsUnique();
        
        // Configure many-to-many relationship with User
        builder
            .HasMany(o => o.UserEntities)
            .WithMany();
        
        // Ignore the computed Users property as it's derived from UserEntities
        builder.Ignore(e => e.Users);
    }

    public IOrganization Map(OrganizationEntity storedEntity)
        => factory(storedEntity);

    public OrganizationEntity Map(IOrganization domainEntity) 
        => new()
        {
            Id = domainEntity.Id,
            Name = domainEntity.Name,
            CreatedAt = domainEntity.CreatedAt,
            UpdatedAt = domainEntity.UpdatedAt,
            UserEntities = domainEntity.Users.Select(userId => new OrganizationUserEntity
            {
                OrganizationId = domainEntity.Id,
                UserId = userId
            }).ToList()
        };
}

