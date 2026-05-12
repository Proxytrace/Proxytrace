using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.ApiKey;
using Trsr.Domain.Events;

namespace Trsr.Storage.Internal.Entities.ApiKey;

[UsedImplicitly]
internal class ApiKeyRepository : AbstractRepository<IApiKey, ApiKeyEntity>, IApiKeyRepository
{
    public ApiKeyRepository(
        IMapper<IApiKey, ApiKeyEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents) : base(mapper, contextFactory, transaction, entityEvents)
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
}
