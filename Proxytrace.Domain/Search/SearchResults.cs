namespace Proxytrace.Domain.Search;

public sealed record SearchResults(IReadOnlyList<SearchHit> Hits);
