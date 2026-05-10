using JetBrains.Annotations;
using Trsr.Domain;
using Trsr.Domain.Events;
using Trsr.Domain.ModelProvider;

namespace Trsr.Storage.Internal.Entities.ModelProvider;

[UsedImplicitly]
internal class ModelProviderRepository : AbstractRepository<IModelProvider, ModelProviderEntity>
{
    public ModelProviderRepository(
        IMapper<IModelProvider, ModelProviderEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents,
        IEntityCache<IModelProvider> cache) : base(mapper, contextFactory, transaction, entityEvents, cache)
    {
    }
}

