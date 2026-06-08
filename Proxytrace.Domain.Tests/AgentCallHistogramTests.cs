using AwesomeAssertions;
using Proxytrace.Domain.AgentCall;

namespace Proxytrace.Domain.Tests;

[TestClass]
public sealed class AgentCallHistogramTests
{
    private static readonly DateTimeOffset From = new(2026, 6, 8, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset To = new(2026, 6, 8, 13, 0, 0, TimeSpan.Zero); // 1h window

    [TestMethod]
    public void Build_ProducesRequestedBucketCount_WithEvenStarts()
    {
        var result = AgentCallHistogram.Build([], From, To, 4);

        result.Should().HaveCount(4);
        result[0].Start.Should().Be(From);
        result[1].Start.Should().Be(From.AddMinutes(15));
        result[3].Start.Should().Be(From.AddMinutes(45));
        result.Should().OnlyContain(b => b.Total == 0 && b.Errors == 0);
    }

    [TestMethod]
    public void Build_AssignsCallsToBucketsAndCountsErrors()
    {
        var calls = new (DateTimeOffset, int)[]
        {
            (From.AddMinutes(1), 200),   // bucket 0
            (From.AddMinutes(2), 500),   // bucket 0, error
            (From.AddMinutes(20), 200),  // bucket 1
            (From.AddMinutes(58), 404),  // bucket 3, error
        };

        var result = AgentCallHistogram.Build(calls, From, To, 4);

        result[0].Total.Should().Be(2);
        result[0].Errors.Should().Be(1);
        result[1].Total.Should().Be(1);
        result[1].Errors.Should().Be(0);
        result[3].Total.Should().Be(1);
        result[3].Errors.Should().Be(1);
    }

    [TestMethod]
    public void Build_ClampsBoundaryTimestampIntoLastBucket()
    {
        var result = AgentCallHistogram.Build([(To, 200)], From, To, 4);

        result[3].Total.Should().Be(1);
    }

    [TestMethod]
    public void Build_IgnoresCallsOutsideWindow()
    {
        var result = AgentCallHistogram.Build(
            [(From.AddMinutes(-5), 200), (To.AddMinutes(5), 200)], From, To, 4);

        result.Sum(b => b.Total).Should().Be(0);
    }

    [TestMethod]
    public void Build_InvalidArguments_Throw()
    {
        var act1 = () => AgentCallHistogram.Build([], From, To, 0);
        act1.Should().Throw<ArgumentOutOfRangeException>();

        var act2 = () => AgentCallHistogram.Build([], To, From, 4);
        act2.Should().Throw<ArgumentException>();
    }
}
