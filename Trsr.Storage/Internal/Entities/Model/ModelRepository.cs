using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Common.Async;
using Trsr.Domain;
using Trsr.Domain.Events;
using Trsr.Domain.Model;

namespace Trsr.Storage.Internal.Entities.Model;

[UsedImplicitly]
internal class ModelRepository : AbstractRepository<IModel, ModelEntity>, IModelRepository
{
    private readonly IModel.CreateNew factory;
    private readonly IAsyncLock locker;

    public ModelRepository(
        IMapper<IModel, ModelEntity> mapper,
        IModel.CreateNew factory,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents,
        IAsyncLock locker,
        IEntityCache<IModel> cache) : base(mapper, contextFactory, transaction, entityEvents, cache)
    {
        this.factory = factory;
        this.locker = locker;
    }

    public async Task<IModel> GetOrCreateAsync(string name, CancellationToken cancellationToken = default)
    {
        var context = ContextFactory();
        var loweredName = name.ToLowerInvariant();
        using IDisposable lockObj = await locker.LockAsync(loweredName, cancellationToken);
        
        var existing = await context
            .Set<ModelEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Name.ToLower() == loweredName, cancellationToken);

        if (existing is not null)
        {
            return await Mapper.Map(existing, cancellationToken);
        }

        var model = factory(name: name);
        return await AddAsync(context, model, cancellationToken);
    }
}

