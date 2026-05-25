namespace Proxytrace.Api.Dto.Search;

public sealed record SearchResultsDto(IReadOnlyList<SearchHitDto> Hits);
