namespace Proxytrace.Application.Ingestion.Internal;

/// <summary>
/// Configuration for the fuzzy agent-version matcher.
/// </summary>
public sealed record AgentVersioningOptions
{
    /// <summary>
    /// Minimum normalized Levenshtein ratio (0..1) on the system prompt for two versions to be
    /// considered the "same logical agent". Tool-set must match identically (loose fingerprint)
    /// before the ratio is consulted.
    /// </summary>
    public double SimilarityThreshold { get; init; } = 0.85;

    /// <summary>
    /// Maximum number of loose-fingerprint-matching candidates to evaluate per ingestion call. Cap
    /// guards against unbounded Levenshtein work when many versions share a loose fingerprint.
    /// </summary>
    public int MaxCandidates { get; init; } = 32;
}
