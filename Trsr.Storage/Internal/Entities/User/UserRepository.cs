using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.User;

namespace Trsr.Storage.Internal.Entities.User;

/// <inheritdoc cref="IUserRepository" />
[UsedImplicitly]
internal class UserRepository : AbstractRepository<IUser, UserEntity>, IUserRepository
{
    public UserRepository(
        IMapper<IUser, UserEntity> mapper,
        Func<StorageDbContext> context,
        ITransaction transaction) : base(
        mapper,
        context,
        transaction)
    {
    }

    /// <inheritdoc />
    public async Task<IUser?> FindByName(
        string name,
        CancellationToken cancellationToken = default) 
        => await contextFactory()
            .Set<UserEntity>()
            .Where(x => x.Name == name)
            .FirstOrDefaultAsync(cancellationToken)
            .ContinueWith(result => Map(result.Result), cancellationToken);
}