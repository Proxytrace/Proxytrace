using Proxytrace.Domain.AgentCall;

namespace Proxytrace.Application.Outliers;

/// <summary>
/// The four per-call metrics evaluated for outliers, taken from a single successful call.
/// </summary>
/// <param name="TotalTokens">Input + output tokens (also the cost signal).</param>
/// <param name="LatencyMs">Response latency in milliseconds.</param>
/// <param name="CacheHitRate">Cached ÷ input tokens, or <see langword="null"/> when the call is the
/// first turn of its conversation (cache-hit is only meaningful from turn 2 onward).</param>
/// <param name="ToolCalls">Number of tool requests in the response.</param>
public readonly record struct OutlierMetrics(
    double TotalTokens,
    double LatencyMs,
    double? CacheHitRate,
    int ToolCalls);

/// <summary>
/// Flags, at ingestion, which characteristics of a call deviate from its agent's recent baseline.
/// </summary>
public interface IOutlierDetector
{
    /// <summary>
    /// Returns the outlier characteristics of <paramref name="metrics"/> relative to the agent's recent
    /// baseline. <see cref="OutlierFlags.None"/> when detection is disabled, the baseline is too small,
    /// or nothing deviates.
    /// </summary>
    Task<OutlierFlags> EvaluateAsync(
        Guid agentId, OutlierMetrics metrics, CancellationToken cancellationToken = default);
}
