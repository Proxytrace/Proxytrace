using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.Model;

namespace Trsr.Storage.Internal.Entities.Model;

[UsedImplicitly]
internal class ModelRepository : AbstractRepository<IModel, ModelEntity>, IModelRepository
{
    private readonly IModel.CreateNew factory;

    public ModelRepository(
        IMapper<IModel, ModelEntity> mapper,
        IModel.CreateNew factory,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityCache<IModel> cache) : base(mapper, contextFactory, transaction, cache)
    {
        this.factory = factory;
    }

    public async Task<IModel> GetOrCreateAsync(string name, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var lowered = name.ToLowerInvariant();
        var existing = await context
            .Set<ModelEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Name.ToLower() == lowered, cancellationToken);

        if (existing is not null)
        {
            return await mapper.Map(existing, cancellationToken);
        }

        var model = factory(name: name);
        return await AddAsync(context, model, cancellationToken);
    }
}

