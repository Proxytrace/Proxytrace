using Microsoft.EntityFrameworkCore;
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
        builder.HasIndex(e => e.Email).IsUnique();
        builder.HasIndex(e => e.ExternalSubject)
            .IsUnique()
            .HasFilter("\"ExternalSubject\" IS NOT NULL");
    }

    public Task<IUser> Map(UserEntity stored, CancellationToken cancellationToken = default)
        => factory(stored.Email, stored.ExternalSubject, stored.PasswordHash, stored.Role, stored).ToTaskResult();

    public Task<UserEntity> Map(IUser domain, CancellationToken cancellationToken = default)
        => new UserEntity
        {
            Id = domain.Id,
            Email = domain.Email,
            ExternalSubject = domain.ExternalSubject,
            PasswordHash = domain.PasswordHash,
            Role = domain.Role,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}
