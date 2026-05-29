using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Proxytrace.Domain;
using Proxytrace.Domain.Events;
using Proxytrace.Domain.Invite;

namespace Proxytrace.Storage.Internal.Entities.Invite;

[UsedImplicitly]
internal class InviteRepository : AbstractRepository<IInvite, InviteEntity>, IInviteRepository
{
    public InviteRepository(
        IMapper<IInvite, InviteEntity> mapper,
        Func<StorageDbContext> context,
        ITransaction transaction,
        IEntityEventService entityEvents,
        AmbientDbContext ambient) : base(mapper, context, transaction, entityEvents, ambient) { }

    public async Task<IInvite?> FindByTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        var entity = await contextFactory().Set<InviteEntity>().AsNoTracking()
            .Where(x => x.Token == token)
            .FirstOrDefaultAsync(cancellationToken);
        return await Map(entity, cancellationToken);
    }
}
