namespace Proxytrace.Domain.Search;

public interface ISearchIndexer
{
    Task IndexAsync(SearchKind kind, Guid projectId, Guid entityId, CancellationToken cancellationToken = default);
    Task RemoveAsync(SearchKind kind, Guid entityId, CancellationToken cancellationToken = default);
    Task ReindexProjectAsync(Guid projectId, CancellationToken cancellationToken = default);
    Task FlushAsync(CancellationToken cancellationToken = default);
}
