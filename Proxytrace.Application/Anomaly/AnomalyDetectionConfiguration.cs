namespace Proxytrace.Application.Anomaly;

/// <summary>
/// Tunable thresholds for <see cref="IAnomalyDetector"/>. Defaults are deliberately conservative to
/// keep false positives low.
/// </summary>
public record AnomalyDetectionConfiguration
{
    /// <summary>
    /// A pass-rate drop of at least this many points (0..1) versus the baseline is flagged.
    /// Default 0.2 (20 points).
    /// </summary>
    public double PassRateDropPoints { get; init; } = 0.2;

    /// <summary>
    /// A pass-rate drop at or above this many points (0..1) is flagged as Critical rather than
    /// Warning. Default 0.4 (40 points).
    /// </summary>
    public double PassRateDropCriticalPoints { get; init; } = 0.4;

    /// <summary>
    /// Average latency at or above this multiple of the baseline is flagged. Default 1.5×.
    /// </summary>
    public double LatencyIncreaseFactor { get; init; } = 1.5;

    /// <summary>Number of prior runs averaged to form the baseline. Default 5.</summary>
    public int BaselineWindow { get; init; } = 5;

    /// <summary>
    /// Minimum number of prior runs required before the comparison rules (pass-rate drop, latency
    /// increase) are evaluated. Below this only the hard run-failed rule fires. Default 3.
    /// </summary>
    public int MinBaselineSamples { get; init; } = 3;
}
