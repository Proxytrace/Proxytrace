using AwesomeAssertions;
using Proxytrace.Application.Optimization.Internal.Validation;

namespace Proxytrace.Application.Tests.Optimization;

/// <summary>
/// Tests for the two-proportion z-test used to gate A/B validation wins, including the
/// significance threshold that keeps sampling noise from spawning proposals.
/// </summary>
[TestClass]
public sealed class ProportionStatsTests
{
    [TestMethod]
    public void TwoSidedPValue_EmptySamples_ReturnsNull()
    {
        ProportionStats.TwoSidedPValue(0, 0, 5, 10).Should().BeNull();
        ProportionStats.TwoSidedPValue(5, 10, 0, 0).Should().BeNull();
    }

    [TestMethod]
    public void TwoSidedPValue_IdenticalAllPassRuns_ReturnsNull()
    {
        // Pooled variance is zero when both runs pass (or fail) every case — undefined p-value.
        ProportionStats.TwoSidedPValue(10, 10, 10, 10).Should().BeNull();
        ProportionStats.TwoSidedPValue(0, 10, 0, 10).Should().BeNull();
    }

    [TestMethod]
    public void TwoSidedPValue_NoDifference_IsNotSignificant()
    {
        double? p = ProportionStats.TwoSidedPValue(5, 10, 5, 10);
        p.Should().NotBeNull();
        p.Should().BeGreaterThan(0.05);
    }

    [TestMethod]
    public void TwoSidedPValue_SmallSampleSmallImprovement_IsNotSignificant()
    {
        // 8/10 → 9/10 is exactly the kind of single-flaky-case "improvement" the gate must reject.
        double? p = ProportionStats.TwoSidedPValue(8, 10, 9, 10);
        p.Should().NotBeNull();
        p.Should().BeGreaterThan(0.05);
    }

    [TestMethod]
    public void TwoSidedPValue_LargeSampleLargeImprovement_IsSignificant()
    {
        double? p = ProportionStats.TwoSidedPValue(50, 100, 80, 100);
        p.Should().NotBeNull();
        p.Should().BeLessThan(0.001);
    }

    [TestMethod]
    public void TwoSidedPValue_IsSymmetric()
    {
        double? improvement = ProportionStats.TwoSidedPValue(50, 100, 70, 100);
        double? regression = ProportionStats.TwoSidedPValue(70, 100, 50, 100);
        improvement.Should().Be(regression);
    }
}
