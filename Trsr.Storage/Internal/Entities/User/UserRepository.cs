using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.Events;
using Trsr.Domain.User;

namespace Trsr.Storage.Internal.Entities.User;

[UsedImplicitly]
internal class UserRepository : AbstractRepository<IUser, UserEntity>, IUserRepository
{
    public UserRepository(
        IMapper<IUser, UserEntity> mapper,
        Func<StorageDbContext> context,
        ITransaction transaction,
        IEntityEventService entityEvents) : base(mapper, context, transaction, entityEvents) { }

    public async Task<IUser?> FindByExternalSubjectAsync(string externalSubject, CancellationToken cancellationToken = default)
    {
        var entity = await contextFactory().Set<UserEntity>().AsNoTracking()
            .Where(x => x.ExternalSubject == externalSubject)
            .FirstOrDefaultAsync(cancellationToken);
        return await Map(entity, cancellationToken);
    }

    public async Task<IUser?> FindByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        var normalized = email.ToLowerInvariant();
        var entity = await contextFactory().Set<UserEntity>().AsNoTracking()
            .Where(x => x.Email.ToLower() == normalized)
            .FirstOrDefaultAsync(cancellationToken);
        return await Map(entity, cancellationToken);
    }
}
