using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Domain.User;

namespace Trsr.Storage.Internal.Entities.User;

internal class UserConfig : AbstractEntityConfiguration<UserEntity>, IMapper<IUser, UserEntity>
{
    private readonly IUser.CreateExisting factory;

    public UserConfig(IUser.CreateExisting factory)
    {
        this.factory = factory;
    }

    public override void Configure(EntityTypeBuilder<UserEntity> builder)
    {
        builder.HasIndex(e => e.Name).IsUnique();
    }

    public Task<IUser> Map(UserEntity stored, CancellationToken cancellationToken = default)
        => factory(stored.Name, stored).ToTaskResult();

    public Task<UserEntity> Map(IUser domain, CancellationToken cancellationToken = default)
        => new UserEntity
        {
            Id = domain.Id,
            Name = domain.Name,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}
