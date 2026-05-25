namespace Proxytrace.Domain.Search;

/// <summary>
/// Read-only statistics about the search index, scoped per project.
/// </summary>
public interface ISearchIndexStatistics
{
    /// <summary>Number of indexed documents associated with the given project.</summary>
    Task<int> CountAsync(Guid projectId, CancellationToken cancellationToken = default);

    /// <summary>Most recent document creation timestamp for the given project, or null if empty.</summary>
    Task<DateTimeOffset?> LastIndexedAtAsync(Guid projectId, CancellationToken cancellationToken = default);
}
