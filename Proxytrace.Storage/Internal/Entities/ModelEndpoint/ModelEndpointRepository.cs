using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Proxytrace.Common.Async;
using Proxytrace.Domain;
using Proxytrace.Domain.Events;
using Proxytrace.Domain.Model;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.ModelProvider;

namespace Proxytrace.Storage.Internal.Entities.ModelEndpoint;

[UsedImplicitly]
internal class ModelEndpointRepository : AbstractRepository<IModelEndpoint, ModelEndpointEntity>,
    IModelEndpointRepository
{
    private readonly IModelRepository models;
    private readonly IAsyncLock locker;
    private readonly IModelEndpoint.CreateNew createNewEndpoint;

    public ModelEndpointRepository(
        IMapper<IModelEndpoint, ModelEndpointEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents,
        IModelRepository models,
        IAsyncLock locker,
        IModelEndpoint.CreateNew createNewEndpoint,
        IEntityCache<IModelEndpoint> cache) : base(mapper, contextFactory, transaction, entityEvents, cache)
    {
        this.models = models;
        this.locker = locker;
        this.createNewEndpoint = createNewEndpoint;
    }

    public async Task<IModelEndpoint> GetOrCreateAsync(
        string modelName,
        IModelProvider provider,
        CancellationToken cancellationToken = default)
    {

        IModel modelEntity = await models.GetOrCreateAsync(modelName, cancellationToken);

        using IDisposable lockObj = await locker.LockAsync(provider.Id, cancellationToken);
        var endpointEntity = await contextFactory().Set<ModelEndpointEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Model == modelEntity.Id && e.Provider == provider.Id, cancellationToken);

        if (endpointEntity is not null)
        {
            return await mapper.Map(endpointEntity, cancellationToken);
        }

        var endpoint = createNewEndpoint(modelEntity, provider, null, null);
        return await AddAsync(endpoint, cancellationToken);
    }
}