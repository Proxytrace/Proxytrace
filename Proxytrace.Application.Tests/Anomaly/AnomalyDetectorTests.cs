using AwesomeAssertions;
using Proxytrace.Application.Anomaly;
using Proxytrace.Application.Anomaly.Internal;
using Proxytrace.Domain.Notification;

namespace Proxytrace.Application.Tests.Anomaly;

[TestClass]
public sealed class AnomalyDetectorTests
{
    private static AnomalyDetector Detector(AnomalyDetectionConfiguration? config = null)
        => new(config ?? new AnomalyDetectionConfiguration());

    private static AnomalyRunInput Run(
        bool failed = false,
        int testCaseCount = 5,
        int resultCount = 5,
        double? currentPassRate = null,
        TimeSpan? currentLatency = null,
        double? baselinePassRate = null,
        TimeSpan? baselineLatency = null,
        int baselineSamples = 5)
        => new(
            EndpointId: Guid.NewGuid(),
            EndpointName: "gpt-4o",
            RunFailed: failed,
            TestCaseCount: testCaseCount,
            ResultCount: resultCount,
            CurrentPassRate: currentPassRate,
            CurrentAverageLatency: currentLatency,
            BaselinePassRate: baselinePassRate,
            BaselineAverageLatency: baselineLatency,
            BaselineSampleCount: baselineSamples);

    private static AnomalyInput Input(bool groupFailed, params AnomalyRunInput[] runs)
        => new(Guid.NewGuid(), Guid.NewGuid(), "My suite", groupFailed, runs);

    [TestMethod]
    public void Detect_WhenGroupFailed_RaisesCriticalGroupAnomaly()
    {
        var result = Detector().Detect(Input(true, Run()));

        result.Should().ContainSingle();
        result[0].Severity.Should().Be(NotificationSeverity.Critical);
        result[0].TargetKind.Should().Be(NotificationTargetKind.TestRunGroup);
    }

    [TestMethod]
    public void Detect_WhenARunFailed_RaisesCritical()
    {
        var result = Detector().Detect(Input(false, Run(failed: true)));

        result.Should().ContainSingle();
        result[0].Severity.Should().Be(NotificationSeverity.Critical);
    }

    [TestMethod]
    public void Detect_WhenARunProducedNoResults_RaisesCritical_WithoutBaseline()
    {
        // The common "endpoint unavailable" shape: every case errored and was skipped, so the run
        // produced no results and never reached Failed status, and there is no baseline.
        var result = Detector().Detect(Input(false,
            Run(testCaseCount: 5, resultCount: 0, baselineSamples: 0)));

        result.Should().ContainSingle();
        result[0].Severity.Should().Be(NotificationSeverity.Critical);
        result[0].TargetKind.Should().Be(NotificationTargetKind.TestRunGroup);
    }

    [TestMethod]
    public void Detect_WhenPassRateDropsBeyondThreshold_RaisesWarning()
    {
        // 30-point drop: past the warning threshold (0.2) but below the critical one (0.4).
        var result = Detector().Detect(Input(false,
            Run(currentPassRate: 0.6, baselinePassRate: 0.9)));

        result.Should().ContainSingle();
        result[0].Severity.Should().Be(NotificationSeverity.Warning);
    }

    [TestMethod]
    public void Detect_WhenPassRateDropsBeyondCriticalThreshold_RaisesCritical()
    {
        var result = Detector().Detect(Input(false,
            Run(currentPassRate: 0.2, baselinePassRate: 0.9)));

        result.Should().ContainSingle();
        result[0].Severity.Should().Be(NotificationSeverity.Critical);
    }

    [TestMethod]
    public void Detect_WhenLatencyExceedsFactor_RaisesWarning()
    {
        var result = Detector().Detect(Input(false,
            Run(currentLatency: TimeSpan.FromSeconds(3), baselineLatency: TimeSpan.FromSeconds(1))));

        result.Should().ContainSingle();
        result[0].Severity.Should().Be(NotificationSeverity.Warning);
    }

    [TestMethod]
    public void Detect_WhenMetricsHealthy_RaisesNothing()
    {
        var result = Detector().Detect(Input(false,
            Run(currentPassRate: 0.9, baselinePassRate: 0.92,
                currentLatency: TimeSpan.FromSeconds(1), baselineLatency: TimeSpan.FromSeconds(1))));

        result.Should().BeEmpty();
    }

    [TestMethod]
    public void Detect_WhenBaselineSamplesBelowMinimum_SkipsComparisonRules()
    {
        var result = Detector().Detect(Input(false,
            Run(currentPassRate: 0.1, baselinePassRate: 0.9, baselineSamples: 1)));

        result.Should().BeEmpty();
    }
}
