using AwesomeAssertions;
using Proxytrace.Application.Optimization.Internal.Validation;

namespace Proxytrace.Application.Tests;

[TestClass]
public sealed class ProportionStatsTests
{
    [TestMethod]
    public void TwoSidedPValue_EmptyBaselineSample_ReturnsNull()
        => ProportionStats.TwoSidedPValue(0, 0, 5, 10).Should().BeNull();

    [TestMethod]
    public void TwoSidedPValue_EmptyCandidateSample_ReturnsNull()
        => ProportionStats.TwoSidedPValue(5, 10, 0, 0).Should().BeNull();

    [TestMethod]
    public void TwoSidedPValue_IdenticalProportions_ReturnsOne()
    {
        // Same pass rate in both arms → z = 0 → two-sided p = 1.
        double? p = ProportionStats.TwoSidedPValue(5, 10, 10, 20);

        p.Should().NotBeNull();
        p!.Value.Should().BeApproximately(1.0, 1e-6);
    }

    [TestMethod]
    public void TwoSidedPValue_AllPassBothArms_ReturnsNull()
    {
        // Pooled variance is zero (everything passes) → p-value undefined.
        ProportionStats.TwoSidedPValue(10, 10, 10, 10).Should().BeNull();
    }

    [TestMethod]
    public void TwoSidedPValue_LargeClearDifference_IsSignificant()
    {
        // 10/100 vs 90/100 is a strong, unambiguous difference.
        double? p = ProportionStats.TwoSidedPValue(10, 100, 90, 100);

        p.Should().NotBeNull();
        p!.Value.Should().BeLessThan(0.001);
    }

    [TestMethod]
    public void TwoSidedPValue_SmallNoisyDifference_IsNotSignificant()
    {
        // 5/10 vs 6/10 is well within sampling noise for tiny samples.
        double? p = ProportionStats.TwoSidedPValue(5, 10, 6, 10);

        p.Should().NotBeNull();
        p!.Value.Should().BeGreaterThan(0.05);
    }

    [TestMethod]
    public void TwoSidedPValue_AlwaysWithinUnitInterval()
    {
        double? p = ProportionStats.TwoSidedPValue(3, 20, 17, 20);

        p.Should().NotBeNull();
        p!.Value.Should().BeInRange(0, 1);
    }
}
