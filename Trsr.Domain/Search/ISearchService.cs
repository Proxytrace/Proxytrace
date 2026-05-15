namespace Trsr.Domain.Search;

public interface ISearchService
{
    Task<SearchResults> SearchAsync(Guid projectId, string query, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Guid>> SearchEntityIdsAsync(
        Guid projectId,
        string query,
        SearchKind kind,
        int maxHits,
        CancellationToken cancellationToken = default);
}
