namespace Proxytrace.Domain.Outliers;

/// <summary>Mean and sample (n−1) standard deviation of one metric over an agent's recent calls.</summary>
/// <param name="Mean">Arithmetic mean of the samples (0 when none).</param>
/// <param name="StdDev">Sample standard deviation (0 when fewer than two samples).</param>
/// <param name="SampleCount">Number of samples the summary is built from.</param>
public readonly record struct MetricBaseline(double Mean, double StdDev, int SampleCount);

/// <summary>
/// Per-agent, per-call baselines over the agent's most recent successful calls, used at ingestion to
/// decide whether a new call is an outlier. <see cref="CacheHitRate"/> only samples turn-2+ calls, so
/// its <see cref="MetricBaseline.SampleCount"/> is typically smaller than the others'.
/// </summary>
public sealed record OutlierBaseline(
    MetricBaseline TotalTokens,
    MetricBaseline LatencyMs,
    MetricBaseline CacheHitRate,
    MetricBaseline ToolCalls)
{
    /// <summary>No baseline — the agent has no recent successful calls. Every metric is unusable.</summary>
    public static OutlierBaseline Empty { get; } = new(default, default, default, default);
}

/// <summary>
/// Computes an agent's recent per-call metric baselines for the ingestion outlier detector.
/// </summary>
public interface IOutlierBaselineReader
{
    /// <summary>
    /// Per-metric mean/stddev over the agent's last <paramref name="sampleWindow"/> successful (2xx)
    /// calls. Returns <see cref="OutlierBaseline.Empty"/> when the agent has no such calls.
    /// </summary>
    Task<OutlierBaseline> GetBaselineAsync(
        Guid agentId, int sampleWindow, CancellationToken cancellationToken = default);
}
