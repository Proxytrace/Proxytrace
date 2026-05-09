namespace Trsr.Api.Dto.Search;

public sealed record SearchHitDto(
    string Kind,
    Guid EntityId,
    string Title,
    string Snippet,
    double Score,
    IReadOnlyDictionary<string, string> Metadata);
