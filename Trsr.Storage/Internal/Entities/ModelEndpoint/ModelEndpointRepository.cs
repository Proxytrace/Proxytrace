using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.Model;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.ModelProvider;
using Trsr.Storage.Internal.Entities.Model;

namespace Trsr.Storage.Internal.Entities.ModelEndpoint;

[UsedImplicitly]
internal class ModelEndpointRepository : AbstractRepository<IModelEndpoint, ModelEndpointEntity>, IModelEndpointRepository
{
    private readonly IModel.CreateNew createNewModel;
    private readonly IModelEndpoint.CreateNew createNewEndpoint;
    private readonly IRepository<IModel> modelRepository;

    public ModelEndpointRepository(
        IMapper<IModelEndpoint, ModelEndpointEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IModel.CreateNew createNewModel,
        IModelEndpoint.CreateNew createNewEndpoint,
        IRepository<IModel> modelRepository) : base(mapper, contextFactory, transaction)
    {
        this.createNewModel = createNewModel;
        this.createNewEndpoint = createNewEndpoint;
        this.modelRepository = modelRepository;
    }

    public async Task<IModelEndpoint> GetOrCreateAsync(string modelName, IModelProvider provider, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();

        var modelEntity = await context.Set<ModelEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Name == modelName, cancellationToken);

        if (modelEntity is not null)
        {
            var endpointEntity = await context.Set<ModelEndpointEntity>()
                .AsNoTracking()
                .FirstOrDefaultAsync(e => e.Model == modelEntity.Id && e.Provider == provider.Id, cancellationToken);

            if (endpointEntity is not null)
            {
                return await mapper.Map(endpointEntity, cancellationToken);
            }
        }

        IModel model = modelEntity is not null
            ? await modelRepository.GetAsync(modelEntity.Id, cancellationToken)
            : await modelRepository.AddAsync(createNewModel(modelName), cancellationToken);

        var endpoint = createNewEndpoint(model, provider, null, null);
        return await AddAsync(endpoint, cancellationToken);
    }
}

