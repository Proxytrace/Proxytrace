using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Domain.User;

namespace Trsr.Storage.Internal.Entities.User;

/// <summary>
/// Entity Framework configuration for <see cref="UserEntity"/>
/// </summary>
internal class UserConfig : AbstractEntityConfiguration<UserEntity>
{
    /// <inheritdoc />
    public override void Configure(EntityTypeBuilder<UserEntity> builder)
    {
        builder
            .HasIndex(e => new{ e.Name })
            .IsUnique();
    }
}