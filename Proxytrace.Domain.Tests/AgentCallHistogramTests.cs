using AwesomeAssertions;
using Proxytrace.Domain.AgentCall;

namespace Proxytrace.Domain.Tests;

[TestClass]
public sealed class AgentCallHistogramTests
{
    private static readonly DateTimeOffset From = new(2026, 6, 8, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset To = new(2026, 6, 8, 13, 0, 0, TimeSpan.Zero); // 1h window

    [TestMethod]
    public void Expand_NoBuckets_ProducesZeroFilledSlots_WithEvenStarts()
    {
        var result = AgentCallHistogram.Expand([], From, To, 4);

        result.Should().HaveCount(4);
        result[0].Start.Should().Be(From);
        result[1].Start.Should().Be(From.AddMinutes(15));
        result[3].Start.Should().Be(From.AddMinutes(45));
        result.Should().OnlyContain(b => b.Total == 0 && b.Errors == 0);
    }

    [TestMethod]
    public void Expand_PlacesAggregatedCountsAtTheirIndex()
    {
        var aggregated = new (int Index, int Total, int Errors)[]
        {
            (0, 2, 1),
            (1, 1, 0),
            (3, 1, 1),
        };

        var result = AgentCallHistogram.Expand(aggregated, From, To, 4);

        result[0].Total.Should().Be(2);
        result[0].Errors.Should().Be(1);
        result[1].Total.Should().Be(1);
        result[1].Errors.Should().Be(0);
        result[2].Total.Should().Be(0);
        result[3].Total.Should().Be(1);
        result[3].Errors.Should().Be(1);
    }

    [TestMethod]
    public void Expand_ClampsOutOfRangeIndicesIntoEdgeBuckets()
    {
        // index == buckets is the boundary case (a call landing exactly on `to`); negatives guard
        // against any provider rounding under-shoot.
        var result = AgentCallHistogram.Expand([(4, 1, 0), (-1, 1, 0)], From, To, 4);

        result[0].Total.Should().Be(1);
        result[3].Total.Should().Be(1);
        result.Sum(b => b.Total).Should().Be(2);
    }

    [TestMethod]
    public void Expand_SumsDuplicateIndices()
    {
        var result = AgentCallHistogram.Expand([(2, 3, 1), (2, 2, 2)], From, To, 4);

        result[2].Total.Should().Be(5);
        result[2].Errors.Should().Be(3);
    }

    [TestMethod]
    public void Expand_InvalidArguments_Throw()
    {
        var act1 = () => AgentCallHistogram.Expand([], From, To, 0);
        act1.Should().Throw<ArgumentOutOfRangeException>();

        var act2 = () => AgentCallHistogram.Expand([], To, From, 4);
        act2.Should().Throw<ArgumentException>();
    }
}
