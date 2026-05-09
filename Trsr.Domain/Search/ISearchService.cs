namespace Trsr.Domain.Search;

public interface ISearchService
{
    Task<SearchResults> SearchAsync(Guid projectId, string query, CancellationToken cancellationToken = default);
}
