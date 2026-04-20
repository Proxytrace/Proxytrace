using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Storage.Internal.Entities.User;

namespace Trsr.Storage.Internal.Entities.Organization;

/// <summary>
/// Configures the many-to-many relationship between Organizations and Users.
/// </summary>
internal class OrganizationUserConfig : AbstractEntityConfiguration<OrganizationUserEntity>
{
    public override void Configure(EntityTypeBuilder<OrganizationUserEntity> builder)
    {
        // Composite primary key
        builder.HasKey(ou => new { ou.OrganizationId, ou.UserId });

        // Configure relationships
        builder
            .HasOne<OrganizationEntity>()
            .WithMany()
            .HasForeignKey(ou => ou.OrganizationId)
            .OnDelete(DeleteBehavior.Cascade);
        
        builder
            .HasOne<UserEntity>()
            .WithMany()
            .HasForeignKey(ou => ou.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        
        // Index for performance on reverse lookups
        builder.HasIndex(ou => ou.UserId);
    }
}

