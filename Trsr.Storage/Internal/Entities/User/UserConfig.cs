using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Domain.User;

namespace Trsr.Storage.Internal.Entities.User;

/// <summary>
/// Entity Framework configuration for <see cref="UserEntity"/>
/// </summary>
internal class UserConfig : AbstractEntityConfiguration<UserEntity>, IMapper<IUser, UserEntity>
{
    private readonly IUser.CreateExisting factory;

    public UserConfig(IUser.CreateExisting factory)
    {
        this.factory = factory;
    }
    
    /// <inheritdoc />
    public override void Configure(EntityTypeBuilder<UserEntity> builder)
    {
        builder
            .HasIndex(e => new{ e.Name })
            .IsUnique();
    }

    public IUser Map(UserEntity storedEntity)
        => factory(storedEntity);

    public UserEntity Map(IUser domainEntity)
        => new()
        {
            Id = domainEntity.Id,
            Name = domainEntity.Name,
            CreatedAt = domainEntity.CreatedAt,
            UpdatedAt = domainEntity.UpdatedAt,
        };
}