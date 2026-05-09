using Trsr.Domain;
using Trsr.Domain.Search;

namespace Trsr.Application.Search.Internal;

internal sealed class ProjectIdResolver<TDomain>
    where TDomain : IDomainEntity
{
    private readonly Func<TDomain, Guid> resolver;
    public ProjectIdResolver(Func<TDomain, Guid> resolver) => this.resolver = resolver;
    public Guid Resolve(TDomain entity) => resolver(entity);
}

internal sealed class IndexingRepositoryDecorator<TDomain> : IRepository<TDomain>
    where TDomain : class, IDomainEntity
{
    private readonly IRepository<TDomain> inner;
    private readonly Lazy<ISearchIndexer> indexer;
    private readonly SearchKind kind;
    private readonly ProjectIdResolver<TDomain> projectIdResolver;

    public IndexingRepositoryDecorator(
        IRepository<TDomain> inner,
        Lazy<ISearchIndexer> indexer,
        SearchKind kind,
        ProjectIdResolver<TDomain> projectIdResolver)
    {
        this.inner = inner;
        this.indexer = indexer;
        this.kind = kind;
        this.projectIdResolver = projectIdResolver;
    }

    public Task<TDomain?> FindAsync(Guid id, CancellationToken cancellationToken = default) => inner.FindAsync(id, cancellationToken);
    public Task<bool> ContainsAsync(Guid id, CancellationToken cancellationToken = default) => inner.ContainsAsync(id, cancellationToken);
    public Task<int> CountAsync(CancellationToken cancellationToken = default) => inner.CountAsync(cancellationToken);
    public Task<IReadOnlyList<TDomain>> GetAllAsync(CancellationToken cancellationToken = default) => inner.GetAllAsync(cancellationToken);
    public Task<IReadOnlyList<TDomain>> GetManyAsync(IReadOnlyCollection<Guid> primaryKeys, CancellationToken cancellationToken = default) => inner.GetManyAsync(primaryKeys, cancellationToken);
    public Task<TDomain?> FindFirstAsync(CancellationToken cancellationToken = default) => inner.FindFirstAsync(cancellationToken);

    public async Task<TDomain> AddAsync(TDomain entity, CancellationToken cancellationToken = default)
    {
        var result = await inner.AddAsync(entity, cancellationToken);
        await indexer.Value.IndexAsync(kind, projectIdResolver.Resolve(result), result.Id, cancellationToken);
        return result;
    }

    public async Task<TDomain> UpdateAsync(TDomain entity, CancellationToken cancellationToken = default)
    {
        var result = await inner.UpdateAsync(entity, cancellationToken);
        await indexer.Value.IndexAsync(kind, projectIdResolver.Resolve(result), result.Id, cancellationToken);
        return result;
    }

    public async Task<TDomain> UpsertAsync(TDomain entity, CancellationToken cancellationToken = default)
    {
        var result = await inner.UpsertAsync(entity, cancellationToken);
        await indexer.Value.IndexAsync(kind, projectIdResolver.Resolve(result), result.Id, cancellationToken);
        return result;
    }

    public async Task<bool> RemoveAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var removed = await inner.RemoveAsync(id, cancellationToken);
        if (removed)
        {
            await indexer.Value.RemoveAsync(kind, id, cancellationToken);
        }
        return removed;
    }

    public Task RemoveAllAsync(CancellationToken cancellationToken = default) => inner.RemoveAllAsync(cancellationToken);
}
