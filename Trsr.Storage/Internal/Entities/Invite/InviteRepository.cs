using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.Events;
using Trsr.Domain.Invite;

namespace Trsr.Storage.Internal.Entities.Invite;

[UsedImplicitly]
internal class InviteRepository : AbstractRepository<IInvite, InviteEntity>, IInviteRepository
{
    public InviteRepository(
        IMapper<IInvite, InviteEntity> mapper,
        Func<StorageDbContext> context,
        ITransaction transaction,
        IEntityEventService entityEvents) : base(mapper, context, transaction, entityEvents) { }

    public async Task<IInvite?> FindByTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        var entity = await ContextFactory().Set<InviteEntity>().AsNoTracking()
            .Where(x => x.Token == token)
            .FirstOrDefaultAsync(cancellationToken);
        return await Map(entity, cancellationToken);
    }
}
