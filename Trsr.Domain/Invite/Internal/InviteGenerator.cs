using Trsr.Common.Random;
using Trsr.Domain.Internal;
using Trsr.Domain.User;

namespace Trsr.Domain.Invite.Internal;

internal class InviteGenerator : DomainEntityGenerator<IInvite>
{
    private readonly IInvite.CreateNew factory;
    private readonly IDomainEntityGenerator<IUser> users;

    public InviteGenerator(
        IInvite.CreateNew factory,
        IDomainEntityGenerator<IUser> users,
        IRepository<IInvite> repository,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.users = users;
    }

    public override async Task<IInvite> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var user = await users.CreateAsync(cancellationToken);
        return factory(
            email: Random.Email(),
            role: Random.Enum<UserRole>(),
            token: Random.UniqueString(),
            expiresAt: DateTimeOffset.UtcNow.AddDays(7),
            invitedBy: user);
    }
}
