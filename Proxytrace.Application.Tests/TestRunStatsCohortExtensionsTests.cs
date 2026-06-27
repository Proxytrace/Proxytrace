using AwesomeAssertions;
using Proxytrace.Domain.Statistics.TestRun;

namespace Proxytrace.Application.Tests;

/// <summary>
/// Tests for <see cref="TestRunStatsCohortExtensions.AggregateSamples"/> — the read-time collapse of a
/// sampled run's per-sample stats rows down to one row per (group, endpoint), used by suite run
/// aggregates, dashboard trends and the agent's latest suite pass rates.
/// </summary>
[TestClass]
public sealed class TestRunStatsCohortExtensionsTests
{
    private static TestRunStats Stats(Guid groupId, Guid endpointId, int passed, decimal? cost = null)
        => new(
            TestRunId: Guid.NewGuid(),
            AgentId: Guid.Empty,
            EndpointId: endpointId,
            GroupId: groupId,
            SuiteId: Guid.Empty,
            TestCases: 10,
            Passed: passed,
            TotalDuration: null,
            Usage: null,
            Cost: cost,
            RunCompletedAt: DateTimeOffset.UtcNow);

    [TestMethod]
    public void AggregateSamples_CollapsesSamplesToOneRowPerEndpoint_WithMeanMetrics()
    {
        var group = Guid.NewGuid();
        var endpoint = Guid.NewGuid();
        var rows = new[]
        {
            Stats(group, endpoint, passed: 6, cost: 0.2m),
            Stats(group, endpoint, passed: 8, cost: 0.4m),
        };

        var aggregated = rows.AggregateSamples();

        aggregated.Should().ContainSingle();
        aggregated[0].Passed.Should().Be(7);  // round(mean(6, 8))
        aggregated[0].Cost.Should().Be(0.3m); // mean(0.2, 0.4) — not the ×N sum
    }

    [TestMethod]
    public void AggregateSamples_KeepsDistinctEndpointsAndGroupsSeparate()
    {
        var groupA = Guid.NewGuid();
        var groupB = Guid.NewGuid();
        var endpoint1 = Guid.NewGuid();
        var endpoint2 = Guid.NewGuid();
        var rows = new[]
        {
            Stats(groupA, endpoint1, passed: 5),
            Stats(groupA, endpoint1, passed: 5),
            Stats(groupA, endpoint2, passed: 5),
            Stats(groupB, endpoint1, passed: 5),
        };

        // 3 cohorts: (A,e1), (A,e2), (B,e1) — the two (A,e1) samples collapse to one.
        rows.AggregateSamples().Should().HaveCount(3);
    }
}
