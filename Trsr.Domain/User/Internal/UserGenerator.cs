using Trsr.Common.Async;
using Trsr.Domain.Internal;

namespace Trsr.Domain.User.Internal;

internal class UserGenerator : DomainEntityGenerator<IUser>
{
    private readonly IUser.CreateNew factory;

    public UserGenerator(
        IUser.CreateNew factory,
        IRepository<IUser> repository) : base(repository)
    {
        this.factory = factory;
    }

    public override Task<IUser> GenerateAsync(CancellationToken cancellationToken = default) 
        => factory(Guid.NewGuid().ToString()).ToTaskResult();
}