using AwesomeAssertions;
using Proxytrace.Domain.Statistics;

namespace Proxytrace.Domain.Tests;

[TestClass]
public sealed class StatisticsTimeTests
{
    [TestMethod]
    public void BucketStart_WithNonUtcOffset_AlignsToUtcBoundaries()
    {
        // 10:20 at +05:30 is 04:50 UTC. Bucketing must align on UTC boundaries regardless of the
        // input offset, matching the epoch-division grouping (WidthMilliseconds/BucketStartFromIndex).
        var timestamp = new DateTimeOffset(2026, 1, 1, 10, 20, 0, TimeSpan.FromMinutes(330));

        StatisticsBucket.FiveMinutes.BucketStart(timestamp)
            .Should().Be(new DateTimeOffset(2026, 1, 1, 4, 50, 0, TimeSpan.Zero));
        StatisticsBucket.Hourly.BucketStart(timestamp)
            .Should().Be(new DateTimeOffset(2026, 1, 1, 4, 0, 0, TimeSpan.Zero));
        StatisticsBucket.Daily.BucketStart(timestamp)
            .Should().Be(new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero));
    }

    [TestMethod]
    public void BucketStart_AgreesWithEpochIndexBucketing()
    {
        // The documented contract: floor((t - epoch) / width) → BucketStartFromIndex must land on
        // the same instant as BucketStart, for any input offset.
        var timestamp = new DateTimeOffset(2026, 6, 15, 23, 47, 12, TimeSpan.FromHours(-7));

        foreach (StatisticsBucket bucket in Enum.GetValues<StatisticsBucket>())
        {
            long index = (long)Math.Floor(
                (timestamp - DateTimeOffset.UnixEpoch).TotalMilliseconds / bucket.WidthMilliseconds());

            bucket.BucketStartFromIndex(index).Should().Be(
                bucket.BucketStart(timestamp),
                $"bucket {bucket} must agree between the two bucketing paths");
        }
    }
}
