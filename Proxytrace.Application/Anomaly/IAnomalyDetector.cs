namespace Proxytrace.Application.Anomaly;

/// <summary>
/// Pure rule engine that turns a completed test-run group's metrics into zero or more anomalies.
/// No I/O — all data arrives via <see cref="AnomalyInput"/>.
/// </summary>
public interface IAnomalyDetector
{
    IReadOnlyList<DetectedAnomaly> Detect(AnomalyInput input);
}
