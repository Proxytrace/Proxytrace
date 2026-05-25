namespace Proxytrace.Domain.Search;

public sealed record SearchHit(
    SearchKind Kind,
    Guid EntityId,
    string Title,
    string Snippet,
    double Score,
    IReadOnlyDictionary<string, string> Metadata);
