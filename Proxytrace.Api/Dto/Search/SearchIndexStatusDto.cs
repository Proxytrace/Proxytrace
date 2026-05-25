namespace Proxytrace.Api.Dto.Search;

public sealed record SearchIndexStatusDto(
    DateTimeOffset? LastIndexedAt,
    int DocumentCount,
    bool IsReindexing);
