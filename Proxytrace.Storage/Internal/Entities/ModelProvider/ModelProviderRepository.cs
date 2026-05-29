using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Proxytrace.Domain;
using Proxytrace.Domain.Events;
using Proxytrace.Domain.ModelProvider;

namespace Proxytrace.Storage.Internal.Entities.ModelProvider;

[UsedImplicitly]
internal class ModelProviderRepository : AbstractRepository<IModelProvider, ModelProviderEntity>, IModelProviderRepository
{
    public ModelProviderRepository(
        IMapper<IModelProvider, ModelProviderEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents,
        IEntityCache<IModelProvider> cache) : base(mapper, contextFactory, transaction, entityEvents, cache)
    {
    }

    public async Task<IModelProvider?> FindByApiKeyAsync(string apiKey, CancellationToken cancellationToken = default)
    {
        var entity = await contextFactory()
            .Set<ModelProviderEntity>()
            .AsNoTracking()
            .Where(e => e.ApiKey == apiKey)
            .FirstOrDefaultAsync(cancellationToken);

        return await Map(entity, cancellationToken);
    }
}

