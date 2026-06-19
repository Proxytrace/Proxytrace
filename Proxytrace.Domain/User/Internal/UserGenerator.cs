using Proxytrace.Common.Async;
using Proxytrace.Common.Random;
using Proxytrace.Domain.Internal;

namespace Proxytrace.Domain.User.Internal;

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
                email: random.Email(),
                externalSubject: $"test|{random.UniqueString()}",
                passwordHash: null,
                role: random.Enum<UserRole>(),
                language: random.Any(SupportedLanguages.All))
            .ToTaskResult();
}
