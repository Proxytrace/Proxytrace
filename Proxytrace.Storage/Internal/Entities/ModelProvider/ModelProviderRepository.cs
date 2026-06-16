using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Proxytrace.Domain;
using Proxytrace.Domain.Events;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Storage.Internal.Entities.ModelEndpoint;

namespace Proxytrace.Storage.Internal.Entities.ModelProvider;

[UsedImplicitly]
internal class ModelProviderRepository : ArchivableRepository<IModelProvider, ModelProviderEntity>, IModelProviderRepository
{
    public ModelProviderRepository(
        IMapper<IModelProvider, ModelProviderEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents,
        IEntityCache<IModelProvider> cache,
        AmbientDbContext ambient) : base(mapper, contextFactory, transaction, entityEvents, ambient, cache)
    {
    }

    public async Task<IModelProvider?> FindByApiKeyAsync(string apiKey, CancellationToken cancellationToken = default)
    {
        // By-key lookup (proxy upstream-key auth): intentionally unfiltered so an archived provider
        // that still receives matching traffic keeps resolving, mirroring agent/endpoint attribution.
        var entity = await contextFactory()
            .Set<ModelProviderEntity>()
            .AsNoTracking()
            .Where(e => e.ApiKey == apiKey)
            .FirstOrDefaultAsync(cancellationToken);

        return await Map(entity, cancellationToken);
    }

    /// <summary>
    /// Archiving a provider also archives its endpoints, so the whole provider disappears from
    /// pickers/listings together. The endpoints are only soft-archived — the AgentCall/TestRun rows
    /// that reference them by id are preserved (a hard provider delete would have cascade-removed them).
    /// </summary>
    protected override async Task ArchiveRelationsAsync(
        StorageDbContext context,
        Guid id,
        CancellationToken cancellationToken)
    {
        var endpoints = await context.Set<ModelEndpointEntity>()
            .Where(e => e.Provider == id && !e.IsArchived)
            .ToListAsync(cancellationToken);

        foreach (var endpoint in endpoints)
        {
            context.Entry(endpoint).CurrentValues.SetValues(
                endpoint with { IsArchived = true, UpdatedAt = DateTimeOffset.UtcNow });
        }
    }
}
