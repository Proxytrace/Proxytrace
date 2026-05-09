namespace Trsr.Domain.Search;

public sealed record SearchResults(IReadOnlyList<SearchHit> Hits);
