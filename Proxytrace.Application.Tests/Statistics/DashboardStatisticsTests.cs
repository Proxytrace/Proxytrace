using AwesomeAssertions;
using NSubstitute;
using Proxytrace.Application.Statistics;
using Proxytrace.Application.Statistics.Internal;
using Proxytrace.Application.Statistics.TestRun;
using Proxytrace.Common.Hosting;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Messaging;
using Proxytrace.Testing;

namespace Proxytrace.Application.Tests.Statistics;

[TestClass]
public sealed class DashboardStatisticsTests : BaseTest<Module>
{
    private static DashboardStatistics Build(
        out IStatsReader<TestRunStats, TestRunStats.Filter> runStats,
        out IAgentCallStatsReader callStats,
        out IAgentRepository agents)
    {
        runStats = Substitute.For<IStatsReader<TestRunStats, TestRunStats.Filter>>();
        callStats = Substitute.For<IAgentCallStatsReader>();
        agents = Substitute.For<IAgentRepository>();
        var agentCalls = Substitute.For<IAgentCallRepository>();
        var ingestionStream = Substitute.For<IIngestionStream>();
        var appVersion = Substitute.For<IAppVersion>();
        appVersion.Version.Returns("0.0.0-dev");
        return new DashboardStatistics(runStats, callStats, agents, agentCalls, ingestionStream, appVersion);
    }

    private static TestRunStats Stat(Guid suiteId, int cases, int passed, DateTimeOffset completed) =>
        new(TestRunId: Guid.NewGuid(),
            AgentId: Guid.NewGuid(),
            EndpointId: Guid.NewGuid(),
            GroupId: Guid.NewGuid(),
            SuiteId: suiteId,
            TestCases: cases,
            Passed: passed,
            TotalDuration: null,
            Usage: null,
            Cost: null,
            RunCompletedAt: completed);

    [TestMethod]
    public async Task GetSummaryAsync_NoRuns_PassRateIsNull()
    {
        var svc = Build(out var runStats, out var callStats, out _);
        callStats.GetSummaryAsync(Arg.Any<StatisticsFilter>(), Arg.Any<CancellationToken>())
            .Returns(new StatisticsSummary(TotalCalls: 5, TotalInputTokens: 10, TotalOutputTokens: 20, TotalCachedInputTokens: 4, AvgLatencyMs: 100, OverallPassRate: 0.5));
        runStats.QueryAsync(Arg.Any<TestRunStats.Filter>(), Arg.Any<CancellationToken>())
            .Returns([]);

        var result = await svc.GetSummaryAsync(new StatisticsFilter(), CancellationToken);

        result.TotalCalls.Should().Be(5);
        result.OverallPassRate.Should().BeNull();
    }

    [TestMethod]
    public async Task GetSummaryAsync_AggregatesPassRate_FromRunStats()
    {
        var svc = Build(out var runStats, out var callStats, out _);
        callStats.GetSummaryAsync(Arg.Any<StatisticsFilter>(), Arg.Any<CancellationToken>())
            .Returns(new StatisticsSummary(0, 0, 0, 0, 0, 0));
        var now = DateTimeOffset.UtcNow;
        runStats.QueryAsync(Arg.Any<TestRunStats.Filter>(), Arg.Any<CancellationToken>())
            .Returns([
                Stat(Guid.NewGuid(), cases: 4, passed: 3, now),
                Stat(Guid.NewGuid(), cases: 6, passed: 3, now),
            ]);

        var result = await svc.GetSummaryAsync(new StatisticsFilter(), CancellationToken);

        // 6 passed / 10 cases = 0.6
        result.OverallPassRate.Should().Be(0.6);
    }

    [TestMethod]
    public async Task GetSummaryAsync_WithProjectFilter_ResolvesAgentsAndPassesAgentIds()
    {
        var svc = Build(out var runStats, out var callStats, out var agents);
        callStats.GetSummaryAsync(Arg.Any<StatisticsFilter>(), Arg.Any<CancellationToken>())
            .Returns(new StatisticsSummary(0, 0, 0, 0, 0, 0));
        runStats.QueryAsync(Arg.Any<TestRunStats.Filter>(), Arg.Any<CancellationToken>())
            .Returns([]);

        var projectId = Guid.NewGuid();
        var matchingAgent = Substitute.For<IAgent>();
        matchingAgent.Id.Returns(Guid.NewGuid());
        matchingAgent.Project.Id.Returns(projectId);
        // The repository scopes to the project server-side, returning only that project's agents.
        agents.GetByProjectAsync(projectId, Arg.Any<CancellationToken>())
            .Returns([matchingAgent]);

        await svc.GetSummaryAsync(new StatisticsFilter(ProjectId: projectId), CancellationToken);

        await runStats.Received(1).QueryAsync(
            Arg.Is<TestRunStats.Filter>(f =>
                f.AgentIds != null && f.AgentIds.Count == 1 && f.AgentIds.Single() == matchingAgent.Id),
            Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task GetDashboardViewAsync_RunsIndependentQueriesConcurrently()
    {
        // The kiosk in-memory EF provider executes queries synchronously (no thread yield). This
        // test reproduces that by making every reader block the calling thread synchronously, then
        // asserts the dashboard fan-out still overlaps them. Before the Task.Run fan-out the queries
        // ran strictly sequentially (max concurrency == 1); this guards that regression.
        ThreadPool.GetMinThreads(out int minW, out int minIo);
        ThreadPool.SetMinThreads(Math.Max(minW, 24), minIo);

        int current = 0;
        int max = 0;
        object gate = new();
        T Track<T>(T value)
        {
            lock (gate)
            {
                current++;
                if (current > max) max = current;
            }
            Thread.Sleep(40);
            lock (gate) { current--; }
            return value;
        }

        var runStats = Substitute.For<IStatsReader<TestRunStats, TestRunStats.Filter>>();
        var callStats = Substitute.For<IAgentCallStatsReader>();
        var agents = Substitute.For<IAgentRepository>();
        var agentCalls = Substitute.For<IAgentCallRepository>();
        var ingestionStream = Substitute.For<IIngestionStream>();
        var appVersion = Substitute.For<IAppVersion>();
        appVersion.Version.Returns("0.0.0-dev");

        runStats.QueryAsync(Arg.Any<TestRunStats.Filter>(), Arg.Any<CancellationToken>()).Returns([]);
        callStats.GetSummaryAsync(Arg.Any<StatisticsFilter>(), Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromResult(Track(new StatisticsSummary(0, 0, 0, 0, 0, null))));
        callStats.GetLiveTelemetryAsync(Arg.Any<StatisticsFilter>(), Arg.Any<DateTimeOffset>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromResult(Track(new LiveTelemetry(0, 0, 0, 0, 0, string.Empty))));
        callStats.GetCallTrendsAsync(Arg.Any<StatisticsFilter>(), Arg.Any<int>(), Arg.Any<DateTimeOffset>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromResult(Track(new CallTrends([], [], []))));
        callStats.GetAgentBreakdownAsync(Arg.Any<StatisticsFilter>(), Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromResult(Track<IReadOnlyList<AgentBreakdownStat>>([])));
        callStats.GetLatencyAsync(Arg.Any<StatisticsFilter>(), Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromResult(Track<IReadOnlyList<LatencyStat>>([])));
        callStats.GetModelBreakdownAsync(Arg.Any<StatisticsFilter>(), Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromResult(Track<IReadOnlyList<ModelBreakdownStat>>([])));
        callStats.GetEarliestCallAsync(Arg.Any<StatisticsFilter>(), Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromResult(Track<DateTimeOffset?>(null)));
        callStats.GetTokenUsageAsync(Arg.Any<StatisticsFilter>(), Arg.Any<StatisticsBucket>(), Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromResult(Track<IReadOnlyList<TokenUsageStat>>([])));
        callStats.GetTokenUsageByAgentAsync(Arg.Any<StatisticsFilter>(), Arg.Any<StatisticsBucket>(), Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromResult(Track<IReadOnlyList<AgentTokenUsageStat>>([])));
        agentCalls.GetFilteredAsync(Arg.Any<AgentCallFilter>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromResult(Track<(IReadOnlyList<IAgentCall>, int)>(([], 0))));
        agentCalls.GetLastCallTimesAsync(Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromResult(Track<IReadOnlyDictionary<Guid, DateTimeOffset>>(new Dictionary<Guid, DateTimeOffset>())));
        agents.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromResult(Track<IReadOnlyList<IAgent>>([])));

        var svc = new DashboardStatistics(runStats, callStats, agents, agentCalls, ingestionStream, appVersion);

        var view = await svc.GetDashboardViewAsync(new StatisticsFilter(), recentTraceCount: 5, agentLimit: 5, CancellationToken);

        view.Should().NotBeNull();
        max.Should().BeGreaterThan(1, "independent dashboard queries must run concurrently, not sequentially");
    }

    [TestMethod]
    public async Task GetTokenUsage_DelegatesToCallStats()
    {
        var svc = Build(out _, out var callStats, out _);
        var bucketStart = DateTimeOffset.UtcNow;
        callStats.GetTokenUsageAsync(Arg.Any<StatisticsFilter>(), Arg.Any<StatisticsBucket>(), Arg.Any<CancellationToken>())
            .Returns([new TokenUsageStat(bucketStart, Guid.NewGuid(), 1, 2, 0)]);

        var result = await svc.GetTokenUsageAsync(new StatisticsFilter(), StatisticsBucket.Daily, CancellationToken);

        result.Should().ContainSingle();
        await callStats.Received(1).GetTokenUsageAsync(Arg.Any<StatisticsFilter>(), Arg.Any<StatisticsBucket>(), Arg.Any<CancellationToken>());
    }
}
