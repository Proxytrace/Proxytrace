using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Storage.Internal.Entities.User;

namespace Trsr.Storage.Internal.Entities.Project;

internal class ProjectUserConfig : AbstractEntityConfiguration<ProjectUserEntity>
{
    public override void Configure(EntityTypeBuilder<ProjectUserEntity> builder)
    {
        builder.HasKey(e => new { e.ProjectId, e.UserId });

        builder
            .HasOne<ProjectEntity>()
            .WithMany(p => p.ProjectUsers)
            .HasForeignKey(e => e.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne<UserEntity>()
            .WithMany()
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => e.UserId);
    }
}
