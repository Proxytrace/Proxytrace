namespace Trsr.Application.Search;

public sealed record SearchConfiguration
{
    public string IndexPath { get; init; } = "searchindex";
    public int TraceRetentionDays { get; init; } = 30;
    public int PrunerIntervalHours { get; init; } = 6;
    public int HitsPerKind { get; init; } = 5;
    public int SnippetMaxChars { get; init; } = 160;
}
