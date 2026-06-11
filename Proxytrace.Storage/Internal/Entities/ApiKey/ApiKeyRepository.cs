using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Proxytrace.Domain;
using Proxytrace.Domain.ApiKey;
using Proxytrace.Domain.Events;

namespace Proxytrace.Storage.Internal.Entities.ApiKey;

[UsedImplicitly]
internal class ApiKeyRepository : AbstractRepository<IApiKey, ApiKeyEntity>, IApiKeyRepository
{
    public ApiKeyRepository(
        IMapper<IApiKey, ApiKeyEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents,
        AmbientDbContext ambient) : base(mapper, contextFactory, transaction, entityEvents, ambient)
    {
    }

    public async Task<IApiKey?> FindByKeyAsync(string key, CancellationToken cancellationToken = default)
    {
        var entity = await contextFactory()
            .Set<ApiKeyEntity>()
            .AsNoTracking()
            .Where(e => e.ApiKey == key)
            .FirstOrDefaultAsync(cancellationToken);

        return await Map(entity, cancellationToken);
    }

    public async Task<IReadOnlyList<IApiKey>> GetByProviderAsync(Guid providerId, CancellationToken cancellationToken = default)
    {
        var stored = await contextFactory()
            .Set<ApiKeyEntity>()
            .AsNoTracking()
            .Where(e => e.Provider == providerId)
            .ToListAsync(cancellationToken);

        return await Map(stored, cancellationToken);
    }
}
