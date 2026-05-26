using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using Proxytrace.Api.Controllers;
using Proxytrace.Api.Dto.AgentCalls;
using Proxytrace.Api.Dto.Agents;
using Proxytrace.Api.Dto.Tools;
using Proxytrace.Application.Statistics;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Testing;

namespace Proxytrace.Api.Tests;

[TestClass]
public sealed class StatisticsControllerTests : BaseTest<Module>
{
    [TestMethod]
    public async Task GetDashboardView_DelegatesToService_AndMapsDto()
    {
        var dashboard = Substitute.For<IDashboardStatistics>();
        var agentId = Guid.NewGuid();
        var endpointId = Guid.NewGuid();
        var date = DateOnly.FromDateTime(DateTime.UtcNow);
        dashboard.GetDashboardViewAsync(Arg.Any<StatisticsFilter>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new DashboardView(
                Summary: new StatisticsSummary(TotalCalls: 42, TotalInputTokens: 100, TotalOutputTokens: 200, AvgLatencyMs: 12.5, OverallPassRate: 0.95),
                LiveTelemetry: new LiveTelemetry(TracesPerMinute: 1, TokensPerSecond: 2, QueueDepth: 3, ErrorRate: 0.1, P95Ms: 55, ProxyVersion: "v1"),
                Trends: new DashboardTrends([1], [2], [3], [4]),
                AgentBreakdown: [new AgentBreakdownStat(agentId, 7)],
                Latency: [new LatencyStat(endpointId, 10, 20, 30, 1, 100, 50)],
                ModelBreakdown: [new ModelBreakdownStat(endpointId, "gpt-4o", CallCount: 3, TotalInputTokens: null, TotalOutputTokens: null, AvgDurationMs: null)],
                TokenUsage: [new TokenUsageStat(date, endpointId, InputTokens: 10, OutputTokens: 20)],
                TokenUsageByAgent: [new AgentTokenUsageStat(date, agentId, InputTokens: 5, OutputTokens: 6)],
                RecentTraces: Array.Empty<IAgentCall>(),
                Agents: Array.Empty<IAgent>(),
                AgentLastCallTimes: new Dictionary<Guid, DateTimeOffset>()));

        var controller = ResolveController(dashboard);

        var result = await controller.GetDashboardView(cancellationToken: CancellationToken);
        var dto = result.Value!;

        dto.Summary.TotalCalls.Should().Be(42);
        dto.LiveTelemetry.P95Ms.Should().Be(55);
        dto.AgentBreakdown.Should().ContainSingle();
        dto.Latency[0].P95Ms.Should().Be(20);
        dto.ModelBreakdown[0].TotalInputTokens.Should().Be(0); // null coerced
        dto.TokenUsage[0].InputTokens.Should().Be(10);
        dto.TokenUsageByAgent[0].OutputTokens.Should().Be(6);
        dto.RecentTraces.Should().BeEmpty();
        dto.Agents.Should().BeEmpty();
    }

    [TestMethod]
    public async Task GetDashboardView_PassesFilterAndLimits()
    {
        var dashboard = Substitute.For<IDashboardStatistics>();
        dashboard.GetDashboardViewAsync(Arg.Any<StatisticsFilter>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new DashboardView(
                new StatisticsSummary(0, 0, 0, 0, null),
                new LiveTelemetry(0, 0, 0, 0, 0, "v"),
                new DashboardTrends([], [], [], []),
                [], [], [], [], [],
                Array.Empty<IAgentCall>(), Array.Empty<IAgent>(), new Dictionary<Guid, DateTimeOffset>()));
        var controller = ResolveController(dashboard);
        var projectId = Guid.NewGuid();
        var from = DateTimeOffset.UtcNow.AddDays(-1);

        await controller.GetDashboardView(from, null, projectId, recentTraceCount: 3, agentLimit: 4, CancellationToken);

        await dashboard.Received(1).GetDashboardViewAsync(
            Arg.Is<StatisticsFilter>(f => f.From == from && f.ProjectId == projectId),
            3, 4, Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task GetAgentOverview_MissingFromTo_ReturnsBadRequest()
    {
        var controller = ResolveController(agentStatistics: Substitute.For<IAgentStatistics>());

        var result = await controller.GetAgentOverview(Guid.NewGuid(), from: null, to: null, cancellationToken: CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task GetAgentOverview_WithFromTo_MapsDto()
    {
        var agentStatistics = Substitute.For<IAgentStatistics>();
        var bucketStart = DateTimeOffset.UtcNow;
        var suiteId = Guid.NewGuid();
        agentStatistics.GetAgentOverviewAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset>(), Arg.Any<DateTimeOffset>(), Arg.Any<StatisticsBucket>(), Arg.Any<CancellationToken>())
            .Returns(new AgentOverviewStat(
                Summary: new AgentTimeSummary(10, 100, 200, 5.5m, 12.5),
                TimeSeries: [new AgentTimeSeriesPoint(bucketStart, 1, 10, 20, 0.5m, 50)],
                PassRateTrend: [new AgentPassRatePoint(bucketStart, 4, 5)],
                SuitePassRates: [new AgentSuitePassRate(suiteId, "Suite A", bucketStart, 3, 3)],
                Counts: new AgentEntityCounts(SuiteCount: 2, TestCaseCount: 6, OpenProposalCount: 1, TotalProposalCount: 4)));
        var controller = ResolveController(agentStatistics: agentStatistics);

        var result = await controller.GetAgentOverview(Guid.NewGuid(), from: bucketStart, to: bucketStart.AddDays(1), bucket: StatisticsBucket.Daily, cancellationToken: CancellationToken);

        var dto = result.Value;
        dto.Should().NotBeNull();
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

    private StatisticsController ResolveController(
        IDashboardStatistics? dashboard = null,
        IAgentStatistics? agentStatistics = null)
    {
        var toolDtoMapper = new ToolDtoMapper();
        return new StatisticsController(
            dashboard ?? Substitute.For<IDashboardStatistics>(),
            agentStatistics ?? Substitute.For<IAgentStatistics>(),
            new AgentCallDtoMapper(toolDtoMapper),
            new AgentDtoMapper(toolDtoMapper));
    }
}
