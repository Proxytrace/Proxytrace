using JetBrains.Annotations;
using Trsr.Domain;
using Trsr.Domain.ModelEndpoint;

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

    public Task<IModelEndpoint> GetOrCreateAsync(string modelName, string providerName, CancellationToken cancellationToken = default)
    {
        throw new NotImplementedException();
    }
}

