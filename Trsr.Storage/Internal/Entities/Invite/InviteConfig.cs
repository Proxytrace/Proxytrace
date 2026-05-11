using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Domain;
using Trsr.Domain.Invite;
using Trsr.Domain.User;
using Trsr.Storage.Internal.Entities.User;

namespace Trsr.Storage.Internal.Entities.Invite;

internal class InviteConfig : AbstractEntityConfiguration<InviteEntity>, IMapper<IInvite, InviteEntity>
{
    private readonly IInvite.CreateExisting factory;
    private readonly IRepository<IUser> users;

    public InviteConfig(IInvite.CreateExisting factory, IRepository<IUser> users)
    {
        this.factory = factory;
        this.users = users;
    }

    public override void Configure(EntityTypeBuilder<InviteEntity> builder)
    {
        builder.HasIndex(e => e.Token).IsUnique();
        builder.HasIndex(e => e.Email);
        builder.HasOne<UserEntity>()
            .WithMany()
            .HasForeignKey(e => e.InvitedBy)
            .OnDelete(DeleteBehavior.Restrict);
    }

    public async Task<IInvite> Map(InviteEntity stored, CancellationToken cancellationToken = default)
    {
        var inviter = await users.GetAsync(stored.InvitedBy, cancellationToken);
        return factory(stored.Email, stored.Role, stored.Token, stored.ExpiresAt, stored.ConsumedAt, inviter, stored);
    }

    public Task<InviteEntity> Map(IInvite domain, CancellationToken cancellationToken = default)
        => new InviteEntity
        {
            Id = domain.Id,
            Email = domain.Email,
            Role = domain.Role,
            Token = domain.Token,
            ExpiresAt = domain.ExpiresAt,
            ConsumedAt = domain.ConsumedAt,
            InvitedBy = domain.InvitedBy.Id,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}
