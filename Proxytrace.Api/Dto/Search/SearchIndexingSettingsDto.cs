namespace Proxytrace.Api.Dto.Search;

public sealed record SearchIndexingSettingsDto(
    bool Enabled,
    IReadOnlyList<string> IndexedKinds,
    bool AutoReindexOnChange,
    int SnippetLength);
