using Trsr.Common.Async;
using Trsr.Common.Random;
using Trsr.Domain.Internal;

namespace Trsr.Domain.User.Internal;

internal class UserGenerator : DomainEntityGenerator<IUser>
{
    private readonly IUser.CreateNew factory;

    public UserGenerator(
        IUser.CreateNew factory,
        IRepository<IUser> repository,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
    }

    public override Task<IUser> GenerateAsync(CancellationToken cancellationToken = default)
        => factory(
                name: random.String(),
                email: random.Email(),
                externalSubject: $"test|{random.UniqueString()}",
                role: random.Enum<UserRole>())
            .ToTaskResult();
}
