using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.User;

namespace Trsr.Storage.Internal.Entities.User;

[UsedImplicitly]
internal class UserRepository : AbstractRepository<IUser, UserEntity>, IUserRepository
{
    public UserRepository(
        IMapper<IUser, UserEntity> mapper,
        Func<StorageDbContext> context,
        ITransaction transaction) : base(mapper, context, transaction)
    {
    }

    public async Task<IUser?> FindByName(string name, CancellationToken cancellationToken = default)
    {
        var entity = await contextFactory()
            .Set<UserEntity>()
            .AsNoTracking()
            .Where(x => x.Name == name)
            .FirstOrDefaultAsync(cancellationToken);
        return await Map(entity, cancellationToken);
    }
}
