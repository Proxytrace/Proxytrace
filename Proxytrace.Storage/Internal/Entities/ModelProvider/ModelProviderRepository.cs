using JetBrains.Annotations;
using Proxytrace.Domain;
using Proxytrace.Domain.Events;
using Proxytrace.Domain.ModelProvider;

namespace Proxytrace.Storage.Internal.Entities.ModelProvider;

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

