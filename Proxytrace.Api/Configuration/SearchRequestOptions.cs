namespace Proxytrace.Api.Configuration;

/// <summary>
/// Request-validation bounds for the search API (query and snippet lengths).
/// </summary>
public sealed record SearchRequestOptions
{
    public int MinQueryLength { get; init; } = 2;
    public int MaxQueryLength { get; init; } = 200;
    public int MinSnippetLength { get; init; } = 20;
    public int MaxSnippetLength { get; init; } = 1000;

    public void Validate()
    {
        if (MinQueryLength < 1 || MinQueryLength > MaxQueryLength)
        {
            throw new InvalidOperationException(
                $"{nameof(SearchRequestOptions)}: {nameof(MinQueryLength)} must be >= 1 and <= {nameof(MaxQueryLength)}.");
        }

        if (MinSnippetLength < 1 || MinSnippetLength > MaxSnippetLength)
        {
            throw new InvalidOperationException(
                $"{nameof(SearchRequestOptions)}: {nameof(MinSnippetLength)} must be >= 1 and <= {nameof(MaxSnippetLength)}.");
        }
    }
}
