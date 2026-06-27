using AwesomeAssertions;
using NSubstitute;
using Proxytrace.Domain.Statistics.TestRun;
using Proxytrace.Application.TestRun;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.TestRun;

namespace Proxytrace.Application.Tests;

/// <summary>
/// Pure-logic tests for <see cref="RunCohort.Build"/> — the per-endpoint cohort grouping, representative
/// selection, and stats aggregation that make sampling transparent to the optimization loop. No DI:
/// the input is a list of (mocked) runs plus a stats-by-run-id map.
/// </summary>
[TestClass]
public sealed class RunCohortTests
{
    private static ITestRun Run(Guid endpointId, int sampleIndex, TestRunStatus status = TestRunStatus.Completed)
    {
        var endpoint = Substitute.For<IModelEndpoint>();
        endpoint.Id.Returns(endpointId);
        var run = Substitute.For<ITestRun>();
        run.Id.Returns(Guid.NewGuid());
        run.Endpoint.Returns(endpoint);
        run.SampleIndex.Returns(sampleIndex);
        run.Status.Returns(status);
        return run;
    }

    private static TestRunStats Stats(
        Guid runId, Guid endpointId, int passed, int testCases = 10,
        TimeSpan? duration = null, decimal? cost = null)
        => new(
            TestRunId: runId,
            AgentId: Guid.Empty,
            EndpointId: endpointId,
            GroupId: Guid.NewGuid(),
            SuiteId: Guid.Empty,
            TestCases: testCases,
            Passed: passed,
            TotalDuration: duration,
            Usage: null,
            Cost: cost,
            RunCompletedAt: DateTimeOffset.UtcNow);

    [TestMethod]
    public void Build_GroupsRunsByEndpoint()
    {
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        var runs = new[] { Run(a, 0), Run(a, 1), Run(b, 0) };
        var stats = runs.ToDictionary(r => r.Id, r => Stats(r.Id, r.Endpoint.Id, passed: 5));

        var cohorts = RunCohort.Build(runs, stats);

        cohorts.Should().HaveCount(2);
        cohorts.Single(c => c.EndpointId == a).Runs.Should().HaveCount(2);
        cohorts.Single(c => c.EndpointId == b).Runs.Should().HaveCount(1);
    }

    [TestMethod]
    public void Build_Representative_IsMedianByPassCount()
    {
        var endpoint = Guid.NewGuid();
        // pass counts [2,5,3,1,4] at sample indices 0..4 → sorted [1,2,3,4,5] → median pass=3 → sample 2
        var passByIndex = new[] { 2, 5, 3, 1, 4 };
        var runs = passByIndex.Select((_, i) => Run(endpoint, i)).ToArray();
        var stats = runs
            .Select((r, i) => Stats(r.Id, endpoint, passByIndex[i]))
            .ToDictionary(s => s.TestRunId);

        var cohort = RunCohort.Build(runs, stats).Single();

        cohort.Representative.SampleIndex.Should().Be(2);
    }

    [TestMethod]
    public void Build_Representative_TieBreaksToLowestSampleIndex()
    {
        var endpoint = Guid.NewGuid();
        var runs = new[] { Run(endpoint, 0), Run(endpoint, 1) };
        var stats = runs.ToDictionary(r => r.Id, r => Stats(r.Id, endpoint, passed: 3));

        var cohort = RunCohort.Build(runs, stats).Single();

        cohort.Representative.SampleIndex.Should().Be(0);
    }

    [TestMethod]
    public void Build_Representative_FallsBackToCompletedSample_WhenNoStats()
    {
        var endpoint = Guid.NewGuid();
        // No stats projected yet → fall back to a completed sample with the lowest index.
        var runs = new[]
        {
            Run(endpoint, 0, TestRunStatus.Running),
            Run(endpoint, 1, TestRunStatus.Completed),
        };

        var cohort = RunCohort.Build(runs, new Dictionary<Guid, TestRunStats>()).Single();

        cohort.Representative.SampleIndex.Should().Be(1);
        cohort.Stats.Should().BeNull();
    }

    [TestMethod]
    public void Build_Stats_AreTheMeanAcrossSamples()
    {
        var endpoint = Guid.NewGuid();
        var runs = new[] { Run(endpoint, 0), Run(endpoint, 1) };
        var stats = new Dictionary<Guid, TestRunStats>
        {
            [runs[0].Id] = Stats(runs[0].Id, endpoint, passed: 6, duration: TimeSpan.FromSeconds(1), cost: 0.2m),
            [runs[1].Id] = Stats(runs[1].Id, endpoint, passed: 8, duration: TimeSpan.FromSeconds(3), cost: 0.4m),
        };

        var cohort = RunCohort.Build(runs, stats).Single();

        cohort.Stats.Should().NotBeNull();
        cohort.Stats?.Passed.Should().Be(7);                              // round(mean(6, 8))
        cohort.Stats?.PassRate.Should().BeApproximately(0.7, 1e-9);       // 7 / 10
        cohort.Stats?.TotalDuration.Should().Be(TimeSpan.FromSeconds(2)); // mean(1s, 3s)
        cohort.Stats?.Cost.Should().Be(0.3m);                            // mean(0.2, 0.4)
        cohort.Stats?.TestRunId.Should().Be(cohort.Representative.Id);    // pinned to the representative
    }
}
