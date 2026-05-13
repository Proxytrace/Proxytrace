using AwesomeAssertions;
using Autofac;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Trsr.Api.Controllers;
using Trsr.Application.Statistics;
using Trsr.Testing;

namespace Trsr.Api.Tests;

[TestClass]
public sealed class StatisticsControllerTests : BaseTest<Module>
{
    [TestMethod]
    public async Task GetSummary_DelegatesToService_AndMapsDto()
    {
        var stats = Substitute.For<IStatisticsService>();
        stats.GetSummaryAsync(Arg.Any<StatisticsFilter>(), Arg.Any<CancellationToken>())
            .Returns(new StatisticsSummary(TotalCalls: 42, TotalInputTokens: 100, TotalOutputTokens: 200, AvgLatencyMs: 12.5, OverallPassRate: 0.95));

        var controller = ResolveController(stats);

        var dto = await controller.GetSummary(cancellationToken: CancellationToken);

        dto.TotalCalls.Should().Be(42);
        dto.TotalInputTokens.Should().Be(100);
        dto.TotalOutputTokens.Should().Be(200);
        dto.AvgLatencyMs.Should().Be(12.5);
        dto.OverallPassRate.Should().Be(0.95);
    }

    [TestMethod]
    public async Task GetSummary_PassesFilterArgumentsThrough()
    {
        var stats = Substitute.For<IStatisticsService>();
        stats.GetSummaryAsync(Arg.Any<StatisticsFilter>(), Arg.Any<CancellationToken>())
            .Returns(new StatisticsSummary(0, 0, 0, 0, null));
        var controller = ResolveController(stats);
        var projectId = Guid.NewGuid();
        var agentId = Guid.NewGuid();
        var endpointId = Guid.NewGuid();
        var from = DateTimeOffset.UtcNow.AddDays(-1);
        var to = DateTimeOffset.UtcNow;

        await controller.GetSummary(from, to, projectId, agentId, endpointId, CancellationToken);

        await stats.Received(1).GetSummaryAsync(
            Arg.Is<StatisticsFilter>(f =>
                f.From == from && f.To == to && f.ProjectId == projectId && f.AgentId == agentId && f.EndpointId == endpointId),
            Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task GetTokenUsage_PassesFilter_AndMaps()
    {
        var stats = Substitute.For<IStatisticsService>();
        var endpointId = Guid.NewGuid();
        var date = DateOnly.FromDateTime(DateTime.UtcNow);
        stats.GetTokenUsageAsync(Arg.Any<StatisticsFilter>(), Arg.Any<CancellationToken>())
            .Returns([new TokenUsageStat(date, endpointId, 10, 20)]);
        var controller = ResolveController(stats);

        var result = await controller.GetTokenUsage(cancellationToken: CancellationToken);

        result.Should().ContainSingle();
        result[0].EndPointId.Should().Be(endpointId);
        result[0].Date.Should().Be(date);
        result[0].InputTokens.Should().Be(10);
        result[0].OutputTokens.Should().Be(20);
    }

    [TestMethod]
    public async Task GetTokenUsage_NullTokenCounts_CoerceToZero()
    {
        var stats = Substitute.For<IStatisticsService>();
        stats.GetTokenUsageAsync(Arg.Any<StatisticsFilter>(), Arg.Any<CancellationToken>())
            .Returns([new TokenUsageStat(DateOnly.FromDateTime(DateTime.UtcNow), Guid.NewGuid(), null, null)]);
        var controller = ResolveController(stats);

        var result = await controller.GetTokenUsage(cancellationToken: CancellationToken);

        result[0].InputTokens.Should().Be(0);
        result[0].OutputTokens.Should().Be(0);
    }

    [TestMethod]
    public async Task GetLatency_MapsResult()
    {
        var stats = Substitute.For<IStatisticsService>();
        var endpointId = Guid.NewGuid();
        stats.GetLatencyAsync(Arg.Any<StatisticsFilter>(), Arg.Any<CancellationToken>())
            .Returns([new LatencyStat(endpointId, 10, 20, 30, 1, 100, 50)]);
        var controller = ResolveController(stats);

        var result = await controller.GetLatency(cancellationToken: CancellationToken);

        result.Should().ContainSingle();
        result[0].EndpointId.Should().Be(endpointId);
        result[0].P50Ms.Should().Be(10);
        result[0].P95Ms.Should().Be(20);
        result[0].P99Ms.Should().Be(30);
        result[0].MinMs.Should().Be(1);
        result[0].MaxMs.Should().Be(100);
        result[0].SampleCount.Should().Be(50);
    }

    [TestMethod]
    public async Task GetPassRates_MapsResult()
    {
        var stats = Substitute.For<IStatisticsService>();
        var suiteId = Guid.NewGuid();
        var ts = DateTimeOffset.UtcNow;
        stats.GetPassRatesAsync(Arg.Any<StatisticsFilter>(), Arg.Any<CancellationToken>())
            .Returns([new PassRateStat(suiteId, ts, PassCount: 8, FailCount: 2)]);
        var controller = ResolveController(stats);

        var result = await controller.GetPassRates(cancellationToken: CancellationToken);

        result.Should().ContainSingle();
        result[0].SuiteId.Should().Be(suiteId);
        result[0].RunTimestamp.Should().Be(ts);
        result[0].PassCount.Should().Be(8);
        result[0].FailCount.Should().Be(2);
    }

    [TestMethod]
    public async Task GetErrorRates_MapsResult()
    {
        var stats = Substitute.For<IStatisticsService>();
        var endpointId = Guid.NewGuid();
        stats.GetErrorRatesAsync(Arg.Any<StatisticsFilter>(), Arg.Any<CancellationToken>())
            .Returns([new ErrorRateStat(endpointId, TotalCalls: 100, ErrorCalls: 5, ErrorRate: 0.05)]);
        var controller = ResolveController(stats);

        var result = await controller.GetErrorRates(cancellationToken: CancellationToken);

        result.Should().ContainSingle();
        result[0].EndpointId.Should().Be(endpointId);
        result[0].TotalCalls.Should().Be(100);
        result[0].ErrorCalls.Should().Be(5);
        result[0].ErrorRate.Should().Be(0.05);
    }

    [TestMethod]
    public async Task GetModelBreakdown_MapsResult_NullsCoerceToZero()
    {
        var stats = Substitute.For<IStatisticsService>();
        var endpointId = Guid.NewGuid();
        stats.GetModelBreakdownAsync(Arg.Any<StatisticsFilter>(), Arg.Any<CancellationToken>())
            .Returns([new ModelBreakdownStat(endpointId, "gpt-4o", CallCount: 3, TotalInputTokens: null, TotalOutputTokens: null, AvgDurationMs: null)]);
        var controller = ResolveController(stats);

        var result = await controller.GetModelBreakdown(cancellationToken: CancellationToken);

        result.Should().ContainSingle();
        result[0].EndpointId.Should().Be(endpointId);
        result[0].ModelName.Should().Be("gpt-4o");
        result[0].CallCount.Should().Be(3);
        result[0].TotalInputTokens.Should().Be(0);
        result[0].TotalOutputTokens.Should().Be(0);
        result[0].AvgDurationMs.Should().Be(0);
    }

    [TestMethod]
    public async Task GetAgentBreakdown_MapsResult()
    {
        var stats = Substitute.For<IStatisticsService>();
        var agentId = Guid.NewGuid();
        stats.GetAgentBreakdownAsync(Arg.Any<StatisticsFilter>(), Arg.Any<CancellationToken>())
            .Returns([new AgentBreakdownStat(agentId, CallCount: 7)]);
        var controller = ResolveController(stats);

        var result = await controller.GetAgentBreakdown(cancellationToken: CancellationToken);

        result.Should().ContainSingle();
        result[0].AgentId.Should().Be(agentId);
        result[0].CallCount.Should().Be(7);
    }

    [TestMethod]
    public async Task GetCostEstimate_MapsResult()
    {
        var stats = Substitute.For<IStatisticsService>();
        var endpointId = Guid.NewGuid();
        stats.GetCostEstimateAsync(Arg.Any<StatisticsFilter>(), Arg.Any<CancellationToken>())
            .Returns([new CostEstimateStat(endpointId, 1.5m, 2.5m, 4.0m)]);
        var controller = ResolveController(stats);

        var result = await controller.GetCostEstimate(cancellationToken: CancellationToken);

        result.Should().ContainSingle();
        result[0].EndpointId.Should().Be(endpointId);
        result[0].InputCostEur.Should().Be(1.5m);
        result[0].OutputCostEur.Should().Be(2.5m);
        result[0].TotalCostEur.Should().Be(4.0m);
    }

    [TestMethod]
    public async Task GetAgentOverview_MissingFromTo_ReturnsBadRequest()
    {
        var controller = ResolveController(Substitute.For<IStatisticsService>());

        var result = await controller.GetAgentOverview(Guid.NewGuid(), from: null, to: null, cancellationToken: CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task GetAgentOverview_WithFromTo_MapsDto()
    {
        var stats = Substitute.For<IStatisticsService>();
        var bucketStart = DateTimeOffset.UtcNow;
        var suiteId = Guid.NewGuid();
        stats.GetAgentOverviewAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset>(), Arg.Any<DateTimeOffset>(), Arg.Any<StatisticsBucket>(), Arg.Any<CancellationToken>())
            .Returns(new AgentOverviewStat(
                Summary: new AgentTimeSummary(10, 100, 200, 5.5m, 12.5),
                TimeSeries: [new AgentTimeSeriesPoint(bucketStart, 1, 10, 20, 0.5m, 50)],
                PassRateTrend: [new AgentPassRatePoint(bucketStart, 4, 5)],
                SuitePassRates: [new AgentSuitePassRate(suiteId, "Suite A", bucketStart, 3, 3)],
                Counts: new AgentEntityCounts(SuiteCount: 2, TestCaseCount: 6, OpenProposalCount: 1, TotalProposalCount: 4)));
        var controller = ResolveController(stats);

        var result = await controller.GetAgentOverview(Guid.NewGuid(), from: bucketStart, to: bucketStart, bucket: StatisticsBucket.Daily, cancellationToken: CancellationToken);

        var dto = result.Value!;
        dto.Summary.TotalTraces.Should().Be(10);
        dto.TimeSeries.Should().ContainSingle();
        dto.PassRateTrend.Should().ContainSingle();
        dto.SuitePassRates.Should().ContainSingle();
        dto.SuitePassRates[0].SuiteId.Should().Be(suiteId);
        dto.Counts.SuiteCount.Should().Be(2);
        dto.Counts.TestCaseCount.Should().Be(6);
        dto.Counts.OpenProposalCount.Should().Be(1);
        dto.Counts.TotalProposalCount.Should().Be(4);
    }

    [TestMethod]
    public async Task GetAgentTimeSeries_MissingFromTo_ReturnsBadRequest()
    {
        var controller = ResolveController(Substitute.For<IStatisticsService>());

        var result = await controller.GetAgentTimeSeries(Guid.NewGuid(), from: null, to: null, cancellationToken: CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task GetAgentTimeSeries_WithFromTo_MapsResult()
    {
        var stats = Substitute.For<IStatisticsService>();
        var bucketStart = DateTimeOffset.UtcNow;
        stats.GetAgentTimeSeriesAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset>(), Arg.Any<DateTimeOffset>(), Arg.Any<StatisticsBucket>(), Arg.Any<CancellationToken>())
            .Returns([new AgentTimeSeriesPoint(bucketStart, TraceCount: 2, InputTokens: 11, OutputTokens: 22, CostEur: 1.1m, AvgLatencyMs: 33)]);
        var controller = ResolveController(stats);

        var result = await controller.GetAgentTimeSeries(Guid.NewGuid(), from: bucketStart, to: bucketStart, cancellationToken: CancellationToken);

        result.Value.Should().ContainSingle();
        result.Value![0].TraceCount.Should().Be(2);
        result.Value![0].InputTokens.Should().Be(11);
        result.Value![0].CostEur.Should().Be(1.1m);
    }

    [TestMethod]
    public async Task GetAgentPassRateTrend_MissingFromTo_ReturnsBadRequest()
    {
        var controller = ResolveController(Substitute.For<IStatisticsService>());

        var result = await controller.GetAgentPassRateTrend(Guid.NewGuid(), from: null, to: null, cancellationToken: CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task GetAgentPassRateTrend_WithFromTo_MapsResult()
    {
        var stats = Substitute.For<IStatisticsService>();
        var bucketStart = DateTimeOffset.UtcNow;
        stats.GetAgentPassRateTrendAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset>(), Arg.Any<DateTimeOffset>(), Arg.Any<StatisticsBucket>(), Arg.Any<CancellationToken>())
            .Returns([new AgentPassRatePoint(bucketStart, Passed: 3, TestCases: 4)]);
        var controller = ResolveController(stats);

        var result = await controller.GetAgentPassRateTrend(Guid.NewGuid(), from: bucketStart, to: bucketStart, cancellationToken: CancellationToken);

        result.Value.Should().ContainSingle();
        result.Value![0].Passed.Should().Be(3);
        result.Value![0].TestCases.Should().Be(4);
    }

    [TestMethod]
    public async Task GetAgentSuitePassRates_MapsResult()
    {
        var stats = Substitute.For<IStatisticsService>();
        var suiteId = Guid.NewGuid();
        var when = DateTimeOffset.UtcNow;
        stats.GetAgentLatestSuitePassRatesAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns([new AgentSuitePassRate(suiteId, "Suite", when, 2, 5)]);
        var controller = ResolveController(stats);

        var result = await controller.GetAgentSuitePassRates(Guid.NewGuid(), CancellationToken);

        result.Should().ContainSingle();
        result[0].SuiteId.Should().Be(suiteId);
        result[0].SuiteName.Should().Be("Suite");
        result[0].LatestRunAt.Should().Be(when);
        result[0].Passed.Should().Be(2);
        result[0].TestCases.Should().Be(5);
    }

    [TestMethod]
    public async Task GetAgentCounts_MapsResult()
    {
        var stats = Substitute.For<IStatisticsService>();
        stats.GetAgentEntityCountsAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(new AgentEntityCounts(SuiteCount: 3, TestCaseCount: 9, OpenProposalCount: 1, TotalProposalCount: 5));
        var controller = ResolveController(stats);

        var dto = await controller.GetAgentCounts(Guid.NewGuid(), CancellationToken);

        dto.SuiteCount.Should().Be(3);
        dto.TestCaseCount.Should().Be(9);
        dto.OpenProposalCount.Should().Be(1);
        dto.TotalProposalCount.Should().Be(5);
    }

    [TestMethod]
    public async Task GetEvaluatorOverview_MissingFromTo_ReturnsBadRequest()
    {
        var controller = ResolveController(Substitute.For<IStatisticsService>());

        var result = await controller.GetEvaluatorOverview(Guid.NewGuid(), from: null, to: null, cancellationToken: CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task GetEvaluatorOverview_WithFromTo_MapsResult()
    {
        var stats = Substitute.For<IStatisticsService>();
        var when = DateTimeOffset.UtcNow;
        stats.GetEvaluatorOverviewAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset>(), Arg.Any<DateTimeOffset>(), Arg.Any<StatisticsBucket>(), Arg.Any<CancellationToken>())
            .Returns(new EvaluatorOverviewStat(
                Summary: new EvaluatorSummary(TotalEvaluations: 10, AvgScore: 0.8, OverallPassRate: 0.9, InputTokens: 1, OutputTokens: 2, TotalCostEur: 3.0m),
                PassRateTrend: [new EvaluatorPassRatePoint(when, Passed: 4, Total: 5)],
                ScoreDistribution: [new EvaluatorScoreBucket("pass", 8)]));
        var controller = ResolveController(stats);

        var result = await controller.GetEvaluatorOverview(Guid.NewGuid(), from: when, to: when, cancellationToken: CancellationToken);

        var dto = result.Value!;
        dto.Summary.TotalEvaluations.Should().Be(10);
        dto.Summary.OverallPassRate.Should().Be(0.9);
        dto.PassRateTrend.Should().ContainSingle();
        dto.ScoreDistribution.Should().ContainSingle();
        dto.ScoreDistribution[0].Score.Should().Be("pass");
    }

    [TestMethod]
    public async Task GetEvaluatorSparklines_MissingProjectId_ReturnsBadRequest()
    {
        var controller = ResolveController(Substitute.For<IStatisticsService>());

        var result = await controller.GetEvaluatorSparklines(projectId: null, from: DateTimeOffset.UtcNow, to: DateTimeOffset.UtcNow, cancellationToken: CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task GetEvaluatorSparklines_MissingFromTo_ReturnsBadRequest()
    {
        var controller = ResolveController(Substitute.For<IStatisticsService>());

        var result = await controller.GetEvaluatorSparklines(projectId: Guid.NewGuid(), from: null, to: null, cancellationToken: CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task GetEvaluatorSparklines_HappyPath_MapsResult()
    {
        var stats = Substitute.For<IStatisticsService>();
        var when = DateTimeOffset.UtcNow;
        var evaluatorId = Guid.NewGuid();
        stats.GetEvaluatorSparklinesAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset>(), Arg.Any<DateTimeOffset>(), Arg.Any<StatisticsBucket>(), Arg.Any<CancellationToken>())
            .Returns([new EvaluatorSparklineStat(evaluatorId, [new EvaluatorPassRatePoint(when, 1, 2)])]);
        var controller = ResolveController(stats);

        var result = await controller.GetEvaluatorSparklines(projectId: Guid.NewGuid(), from: when, to: when, cancellationToken: CancellationToken);

        result.Value.Should().ContainSingle();
        result.Value![0].EvaluatorId.Should().Be(evaluatorId);
        result.Value![0].Points.Should().ContainSingle();
    }

    private StatisticsController ResolveController(IStatisticsService stats)
    {
        IServiceProvider services = GetServices(b => b.RegisterInstance(stats).As<IStatisticsService>());
        return new StatisticsController(services.GetRequiredService<IStatisticsService>());
    }
}
