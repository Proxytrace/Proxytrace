using JetBrains.Annotations;
using Trsr.Domain;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.ModelProvider;

namespace Trsr.Storage.Internal.Entities.ModelEndpoint;

[UsedImplicitly]
internal class ModelEndpointRepository : AbstractRepository<IModelEndpoint, ModelEndpointEntity>, IModelEndpointRepository
{
    public ModelEndpointRepository(
        IMapper<IModelEndpoint, ModelEndpointEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction) : base(mapper, contextFactory, transaction)
    {
    }

    public Task<IModelEndpoint> GetOrCreateAsync(string modelName, IModelProvider provider, CancellationToken cancellationToken = default)
    {
        throw new NotImplementedException();
    }
}

