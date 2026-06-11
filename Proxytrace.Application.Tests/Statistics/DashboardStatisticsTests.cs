using AwesomeAssertions;
using NSubstitute;
using Proxytrace.Application.Statistics;
using Proxytrace.Application.Statistics.Internal;
using Proxytrace.Application.Statistics.TestRun;
using Proxytrace.Common.Hosting;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
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
        var appVersion = Substitute.For<IAppVersion>();
        appVersion.Version.Returns("0.0.0-dev");
        return new DashboardStatistics(runStats, callStats, agents, agentCalls, appVersion);
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
            .Returns(new StatisticsSummary(TotalCalls: 5, TotalInputTokens: 10, TotalOutputTokens: 20, AvgLatencyMs: 100, OverallPassRate: 0.5));
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
            .Returns(new StatisticsSummary(0, 0, 0, 0, 0));
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
            .Returns(new StatisticsSummary(0, 0, 0, 0, 0));
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
    public async Task GetTokenUsage_DelegatesToCallStats()
    {
        var svc = Build(out _, out var callStats, out _);
        var bucketStart = DateTimeOffset.UtcNow;
        callStats.GetTokenUsageAsync(Arg.Any<StatisticsFilter>(), Arg.Any<StatisticsBucket>(), Arg.Any<CancellationToken>())
            .Returns([new TokenUsageStat(bucketStart, Guid.NewGuid(), 1, 2)]);

        var result = await svc.GetTokenUsageAsync(new StatisticsFilter(), StatisticsBucket.Daily, CancellationToken);

        result.Should().ContainSingle();
        await callStats.Received(1).GetTokenUsageAsync(Arg.Any<StatisticsFilter>(), Arg.Any<StatisticsBucket>(), Arg.Any<CancellationToken>());
    }
}
