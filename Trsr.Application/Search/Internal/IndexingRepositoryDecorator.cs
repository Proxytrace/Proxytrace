using Trsr.Domain;
using Trsr.Domain.Search;

namespace Trsr.Application.Search.Internal;

internal sealed class IndexingRepositoryDecorator<TDomain> : IRepository<TDomain>
    where TDomain : class, IDomainEntity, ISearchable
{
    private readonly IRepository<TDomain> inner;
    private readonly Lazy<ISearchIndexer> indexer;
    private readonly Lazy<IProjectSearchSettingsResolver> settings;

    public IndexingRepositoryDecorator(
        IRepository<TDomain> inner,
        Lazy<ISearchIndexer> indexer,
        Lazy<IProjectSearchSettingsResolver> settings)
    {
        this.inner = inner;
        this.indexer = indexer;
        this.settings = settings;
    }

    public Task<TDomain?> FindAsync(Guid id, CancellationToken cancellationToken = default) => inner.FindAsync(id, cancellationToken);
    public Task<bool> ContainsAsync(Guid id, CancellationToken cancellationToken = default) => inner.ContainsAsync(id, cancellationToken);
    public Task<int> CountAsync(CancellationToken cancellationToken = default) => inner.CountAsync(cancellationToken);
    public IAsyncEnumerable<TDomain> EnumerateAsync(CancellationToken cancellationToken = default) => inner.EnumerateAsync(cancellationToken);
    public Task<IReadOnlyList<TDomain>> GetAllAsync(CancellationToken cancellationToken = default) => inner.GetAllAsync(cancellationToken);
    public Task<IReadOnlyList<TDomain>> GetManyAsync(IReadOnlyCollection<Guid> primaryKeys, CancellationToken cancellationToken = default) => inner.GetManyAsync(primaryKeys, cancellationToken);
    public Task<TDomain?> FindFirstAsync(CancellationToken cancellationToken = default) => inner.FindFirstAsync(cancellationToken);

    public async Task<TDomain> AddAsync(TDomain entity, CancellationToken cancellationToken = default)
    {
        var result = await inner.AddAsync(entity, cancellationToken);
        await IndexIfAllowedAsync(result, cancellationToken);
        return result;
    }

    public async Task<TDomain> UpdateAsync(TDomain entity, CancellationToken cancellationToken = default)
    {
        var result = await inner.UpdateAsync(entity, cancellationToken);
        await IndexIfAllowedAsync(result, cancellationToken);
        return result;
    }

    public async Task<TDomain> UpsertAsync(TDomain entity, CancellationToken cancellationToken = default)
    {
        var result = await inner.UpsertAsync(entity, cancellationToken);
        await IndexIfAllowedAsync(result, cancellationToken);
        return result;
    }

    public async Task<bool> RemoveAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var existing = await inner.FindAsync(id, cancellationToken);
        var removed = await inner.RemoveAsync(id, cancellationToken);
        if (existing != null && removed)
        {
            // Removal always runs — disabling indexing shouldn't leave orphan documents in the index.
            await indexer.Value.RemoveAsync(existing.SearchKind, id, cancellationToken);
        }
        return removed;
    }

    public Task RemoveAllAsync(CancellationToken cancellationToken = default) => inner.RemoveAllAsync(cancellationToken);

    private async Task IndexIfAllowedAsync(TDomain entity, CancellationToken cancellationToken)
    {
        var resolved = await settings.Value.GetOrDefaultsAsync(entity.Project.Id, cancellationToken);
        if (!resolved.Enabled || !resolved.AutoReindexOnChange || !resolved.IndexedKinds.Contains(entity.SearchKind))
        {
            return;
        }
        await indexer.Value.IndexAsync(entity.SearchKind, entity.Project.Id, entity.Id, cancellationToken);
    }
}
