using JetBrains.Annotations;
using Trsr.Domain;
using Trsr.Domain.Model;

namespace Trsr.Storage.Internal.Entities.Model;

[UsedImplicitly]
internal class ModelRepository : AbstractRepository<IModel, ModelEntity>
{
    public ModelRepository(
        IMapper<IModel, ModelEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityCache<IModel> cache) : base(mapper, contextFactory, transaction, cache)
    {
    }
}

