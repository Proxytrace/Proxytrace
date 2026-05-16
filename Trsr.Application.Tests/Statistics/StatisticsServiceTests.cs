using AwesomeAssertions;
using NSubstitute;
using Trsr.Application.Statistics;
using Trsr.Application.Statistics.Internal;
using Trsr.Application.Statistics.TestRun;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.Exceptions;
using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.TestSuite;
using Trsr.Testing;

namespace Trsr.Application.Tests.Statistics;

[TestClass]
public sealed class StatisticsServiceTests : BaseTest<Module>
{
    private static StatisticsService Build(
        out IStatsReader<TestRunStats, TestRunStats.Filter> runStats,
        out IAgentCallStatsReader callStats,
        out IEvaluatorStatsReader evaluatorStats,
        out IRepository<IAgent> agents,
        out IRepository<ITestSuite> testSuites,
        out IRepository<IOptimizationProposal> proposals)
    {
        runStats = Substitute.For<IStatsReader<TestRunStats, TestRunStats.Filter>>();
        callStats = Substitute.For<IAgentCallStatsReader>();
        evaluatorStats = Substitute.For<IEvaluatorStatsReader>();
        agents = Substitute.For<IRepository<IAgent>>();
        testSuites = Substitute.For<IRepository<ITestSuite>>();
        proposals = Substitute.For<IRepository<IOptimizationProposal>>();
        return new StatisticsService(runStats, callStats, evaluatorStats, agents, testSuites, proposals);
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
        var svc = Build(out var runStats, out var callStats, out _, out _, out _, out _);
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
        var svc = Build(out var runStats, out var callStats, out _, out _, out _, out _);
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
        var svc = Build(out var runStats, out var callStats, out _, out var agents, out _, out _);
        callStats.GetSummaryAsync(Arg.Any<StatisticsFilter>(), Arg.Any<CancellationToken>())
            .Returns(new StatisticsSummary(0, 0, 0, 0, 0));
        runStats.QueryAsync(Arg.Any<TestRunStats.Filter>(), Arg.Any<CancellationToken>())
            .Returns([]);

        var projectId = Guid.NewGuid();
        var matchingAgent = Substitute.For<IAgent>();
        matchingAgent.Id.Returns(Guid.NewGuid());
        matchingAgent.Project.Id.Returns(projectId);
        var otherAgent = Substitute.For<IAgent>();
        otherAgent.Id.Returns(Guid.NewGuid());
        otherAgent.Project.Id.Returns(Guid.NewGuid());
        agents.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns([matchingAgent, otherAgent]);

        await svc.GetSummaryAsync(new StatisticsFilter(ProjectId: projectId), CancellationToken);

        await runStats.Received(1).QueryAsync(
            Arg.Is<TestRunStats.Filter>(f =>
                f.AgentIds != null && f.AgentIds.Count == 1 && f.AgentIds.Single() == matchingAgent.Id),
            Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task GetPassRatesAsync_OrdersDescendingByRunCompletedAt()
    {
        var svc = Build(out var runStats, out _, out _, out _, out _, out _);
        var suite = Guid.NewGuid();
        var older = DateTimeOffset.UtcNow.AddHours(-2);
        var newer = DateTimeOffset.UtcNow;
        runStats.QueryAsync(Arg.Any<TestRunStats.Filter>(), Arg.Any<CancellationToken>())
            .Returns([Stat(suite, 5, 3, older), Stat(suite, 4, 4, newer)]);

        var result = await svc.GetPassRatesAsync(new StatisticsFilter(), CancellationToken);

        result.Should().HaveCount(2);
        result[0].RunTimestamp.Should().Be(newer);
        result[0].PassCount.Should().Be(4);
        result[0].FailCount.Should().Be(0);
        result[1].RunTimestamp.Should().Be(older);
        result[1].PassCount.Should().Be(3);
        result[1].FailCount.Should().Be(2);
    }

    [TestMethod]
    public async Task GetAgentOverviewAsync_ComposesAllSubQueries()
    {
        var svc = Build(out var runStats, out var callStats, out _, out _, out var testSuites, out var proposals);
        var agentId = Guid.NewGuid();
        var from = DateTimeOffset.UtcNow.AddDays(-1);
        var to = DateTimeOffset.UtcNow;

        var summary = new AgentTimeSummary(5, 10, 20, 1.5m, 30);
        IReadOnlyList<AgentTimeSeriesPoint> series = [new AgentTimeSeriesPoint(to, 1, 5, 10, 0.5m, 30)];
        callStats.GetAgentWindowAsync(agentId, from, to, StatisticsBucket.Daily, Arg.Any<CancellationToken>())
            .Returns((series, summary));

        runStats.QueryAsync(Arg.Any<TestRunStats.Filter>(), Arg.Any<CancellationToken>())
            .Returns([Stat(Guid.NewGuid(), 3, 2, to)]);

        testSuites.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);
        testSuites.GetManyAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns([]);
        proposals.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);

        var result = await svc.GetAgentOverviewAsync(agentId, from, to, StatisticsBucket.Daily, CancellationToken);

        result.Summary.Should().Be(summary);
        result.TimeSeries.Should().BeEquivalentTo(series);
        result.PassRateTrend.Should().HaveCount(1);
        result.Counts.SuiteCount.Should().Be(0);
    }

    [TestMethod]
    public async Task GetAgentPassRateTrendAsync_BucketsByBucketStart()
    {
        var svc = Build(out var runStats, out _, out _, out _, out _, out _);
        var bucketA = new DateTimeOffset(2026, 5, 1, 0, 0, 0, TimeSpan.Zero);
        var bucketB = new DateTimeOffset(2026, 5, 2, 0, 0, 0, TimeSpan.Zero);
        runStats.QueryAsync(Arg.Any<TestRunStats.Filter>(), Arg.Any<CancellationToken>())
            .Returns([
                Stat(Guid.NewGuid(), 5, 4, bucketA.AddHours(3)),
                Stat(Guid.NewGuid(), 3, 1, bucketA.AddHours(6)),
                Stat(Guid.NewGuid(), 2, 2, bucketB.AddHours(2)),
            ]);

        var result = await svc.GetAgentPassRateTrendAsync(Guid.NewGuid(), bucketA, bucketB.AddDays(1), StatisticsBucket.Daily, CancellationToken);

        result.Should().HaveCount(2);
        result[0].BucketStart.Should().Be(bucketA);
        result[0].Passed.Should().Be(5);
        result[0].TestCases.Should().Be(8);
        result[1].BucketStart.Should().Be(bucketB);
        result[1].Passed.Should().Be(2);
        result[1].TestCases.Should().Be(2);
    }

    [TestMethod]
    public async Task GetAgentLatestSuitePassRatesAsync_NoRuns_ReturnsEmpty()
    {
        var svc = Build(out var runStats, out _, out _, out _, out _, out _);
        runStats.QueryAsync(Arg.Any<TestRunStats.Filter>(), Arg.Any<CancellationToken>())
            .Returns([]);

        var result = await svc.GetAgentLatestSuitePassRatesAsync(Guid.NewGuid(), CancellationToken);

        result.Should().BeEmpty();
    }

    [TestMethod]
    public async Task GetAgentLatestSuitePassRatesAsync_PicksLatestPerSuite()
    {
        var svc = Build(out var runStats, out _, out _, out _, out var testSuites, out _);
        var suiteId = Guid.NewGuid();
        var older = DateTimeOffset.UtcNow.AddDays(-2);
        var newer = DateTimeOffset.UtcNow;
        runStats.QueryAsync(Arg.Any<TestRunStats.Filter>(), Arg.Any<CancellationToken>())
            .Returns([Stat(suiteId, 4, 1, older), Stat(suiteId, 4, 4, newer)]);

        var suite = Substitute.For<ITestSuite>();
        suite.Id.Returns(suiteId);
        suite.Name.Returns("My Suite");
        testSuites.GetManyAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns([suite]);

        var result = await svc.GetAgentLatestSuitePassRatesAsync(Guid.NewGuid(), CancellationToken);

        result.Should().ContainSingle();
        result[0].SuiteId.Should().Be(suiteId);
        result[0].SuiteName.Should().Be("My Suite");
        result[0].LatestRunAt.Should().Be(newer);
        result[0].Passed.Should().Be(4);
        result[0].TestCases.Should().Be(4);
    }

    [TestMethod]
    public async Task GetAgentLatestSuitePassRatesAsync_DeletedSuite_FallsBackToFindAsync()
    {
        var svc = Build(out var runStats, out _, out _, out _, out var testSuites, out _);
        var liveSuiteId = Guid.NewGuid();
        var deletedSuiteId = Guid.NewGuid();
        var when = DateTimeOffset.UtcNow;
        runStats.QueryAsync(Arg.Any<TestRunStats.Filter>(), Arg.Any<CancellationToken>())
            .Returns([Stat(liveSuiteId, 3, 3, when), Stat(deletedSuiteId, 2, 1, when)]);

        var liveSuite = Substitute.For<ITestSuite>();
        liveSuite.Id.Returns(liveSuiteId);
        liveSuite.Name.Returns("Live");

        testSuites.GetManyAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<IReadOnlyList<ITestSuite>>(new EntitiesNotFoundException([deletedSuiteId], typeof(ITestSuite))));
        testSuites.FindAsync(liveSuiteId, Arg.Any<CancellationToken>()).Returns(liveSuite);
        testSuites.FindAsync(deletedSuiteId, Arg.Any<CancellationToken>()).Returns((ITestSuite?)null);

        var result = await svc.GetAgentLatestSuitePassRatesAsync(Guid.NewGuid(), CancellationToken);

        result.Should().ContainSingle();
        result[0].SuiteId.Should().Be(liveSuiteId);
        result[0].SuiteName.Should().Be("Live");
    }

    [TestMethod]
    public async Task GetAgentEntityCountsAsync_CountsAgentScopedSuitesProposalsAndOpenStatus()
    {
        var svc = Build(out _, out _, out _, out _, out var testSuites, out var proposals);
        var agentId = Guid.NewGuid();
        var otherAgentId = Guid.NewGuid();

        var suiteA = Substitute.For<ITestSuite>();
        suiteA.Agent.Id.Returns(agentId);
        suiteA.TestCases.Returns([Substitute.For<Domain.TestCase.ITestCase>(), Substitute.For<Domain.TestCase.ITestCase>()]);
        var suiteB = Substitute.For<ITestSuite>();
        suiteB.Agent.Id.Returns(agentId);
        suiteB.TestCases.Returns([Substitute.For<Domain.TestCase.ITestCase>()]);
        var suiteOther = Substitute.For<ITestSuite>();
        suiteOther.Agent.Id.Returns(otherAgentId);
        suiteOther.TestCases.Returns([Substitute.For<Domain.TestCase.ITestCase>()]);
        testSuites.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns([suiteA, suiteB, suiteOther]);

        var draftProposal = Substitute.For<IOptimizationProposal>();
        draftProposal.Agent.Id.Returns(agentId);
        draftProposal.Status.Returns(ProposalStatus.Draft);
        var approvedProposal = Substitute.For<IOptimizationProposal>();
        approvedProposal.Agent.Id.Returns(agentId);
        approvedProposal.Status.Returns(ProposalStatus.Accepted);
        var otherProposal = Substitute.For<IOptimizationProposal>();
        otherProposal.Agent.Id.Returns(otherAgentId);
        otherProposal.Status.Returns(ProposalStatus.Draft);
        proposals.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns([draftProposal, approvedProposal, otherProposal]);

        var result = await svc.GetAgentEntityCountsAsync(agentId, CancellationToken);

        result.SuiteCount.Should().Be(2);
        result.TestCaseCount.Should().Be(3);
        result.OpenProposalCount.Should().Be(1);
        result.TotalProposalCount.Should().Be(2);
    }

    [TestMethod]
    public async Task GetTokenUsage_DelegatesToCallStats()
    {
        var svc = Build(out _, out var callStats, out _, out _, out _, out _);
        var date = DateOnly.FromDateTime(DateTime.UtcNow);
        callStats.GetTokenUsageAsync(Arg.Any<StatisticsFilter>(), Arg.Any<CancellationToken>())
            .Returns([new TokenUsageStat(date, Guid.NewGuid(), 1, 2)]);

        var result = await svc.GetTokenUsageAsync(new StatisticsFilter(), CancellationToken);

        result.Should().ContainSingle();
        await callStats.Received(1).GetTokenUsageAsync(Arg.Any<StatisticsFilter>(), Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task GetEvaluatorOverview_DelegatesToEvaluatorReader()
    {
        var svc = Build(out _, out _, out var evaluatorStats, out _, out _, out _);
        var expected = new EvaluatorOverviewStat(
            new EvaluatorSummary(1, null, null, null, null, null, null), [], [], []);
        var id = Guid.NewGuid();
        evaluatorStats.GetOverviewAsync(id, Arg.Any<DateTimeOffset>(), Arg.Any<DateTimeOffset>(), StatisticsBucket.Daily, Arg.Any<CancellationToken>())
            .Returns(expected);

        var result = await svc.GetEvaluatorOverviewAsync(id, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow, StatisticsBucket.Daily, CancellationToken);

        result.Should().BeSameAs(expected);
    }

    [TestMethod]
    public async Task GetEvaluatorSparklines_DelegatesToEvaluatorReader()
    {
        var svc = Build(out _, out _, out var evaluatorStats, out _, out _, out _);
        var projectId = Guid.NewGuid();
        evaluatorStats.GetSparklinesAsync(projectId, Arg.Any<DateTimeOffset>(), Arg.Any<DateTimeOffset>(), StatisticsBucket.Daily, Arg.Any<CancellationToken>())
            .Returns([new EvaluatorSparklineStat(Guid.NewGuid(), [])]);

        var result = await svc.GetEvaluatorSparklinesAsync(projectId, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow, StatisticsBucket.Daily, CancellationToken);

        result.Should().ContainSingle();
    }
}
