namespace Proxytrace.Application.Anomaly;

/// <summary>
/// Pure input to <see cref="IAnomalyDetector"/> for one completed test-run group. Assembled by
/// <see cref="Internal.AnomalyDetectionService"/> from the group, its runs and the per-run stats
/// (current + rolling baseline) so detection itself is free of I/O and directly unit-testable.
/// </summary>
public record AnomalyInput(
    Guid GroupId,
    Guid? ProjectId,
    string SuiteName,
    bool GroupFailed,
    IReadOnlyList<AnomalyRunInput> Runs);

/// <summary>Per-endpoint slice of an <see cref="AnomalyInput"/>.</summary>
public record AnomalyRunInput(
    Guid EndpointId,
    string EndpointName,
    bool RunFailed,
    double? CurrentPassRate,
    TimeSpan? CurrentAverageLatency,
    double? BaselinePassRate,
    TimeSpan? BaselineAverageLatency,
    int BaselineSampleCount);
