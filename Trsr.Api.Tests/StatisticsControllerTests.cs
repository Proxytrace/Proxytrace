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

        IServiceProvider services = GetServices(b => b.RegisterInstance(stats).As<IStatisticsService>());
        var controller = new StatisticsController(services.GetRequiredService<IStatisticsService>());

        var dto = await controller.GetSummary(cancellationToken: CancellationToken);

        dto.TotalCalls.Should().Be(42);
        dto.OverallPassRate.Should().Be(0.95);
    }

    [TestMethod]
    public async Task GetAgentOverview_MissingFromTo_ReturnsBadRequest()
    {
        var stats = Substitute.For<IStatisticsService>();
        IServiceProvider services = GetServices(b => b.RegisterInstance(stats).As<IStatisticsService>());
        var controller = new StatisticsController(services.GetRequiredService<IStatisticsService>());

        var result = await controller.GetAgentOverview(Guid.NewGuid(), from: null, to: null, cancellationToken: CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task GetAgentTimeSeries_MissingFromTo_ReturnsBadRequest()
    {
        var stats = Substitute.For<IStatisticsService>();
        IServiceProvider services = GetServices(b => b.RegisterInstance(stats).As<IStatisticsService>());
        var controller = new StatisticsController(services.GetRequiredService<IStatisticsService>());

        var result = await controller.GetAgentTimeSeries(Guid.NewGuid(), from: null, to: null, cancellationToken: CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task GetAgentPassRateTrend_MissingFromTo_ReturnsBadRequest()
    {
        var stats = Substitute.For<IStatisticsService>();
        IServiceProvider services = GetServices(b => b.RegisterInstance(stats).As<IStatisticsService>());
        var controller = new StatisticsController(services.GetRequiredService<IStatisticsService>());

        var result = await controller.GetAgentPassRateTrend(Guid.NewGuid(), from: null, to: null, cancellationToken: CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task GetEvaluatorOverview_MissingFromTo_ReturnsBadRequest()
    {
        var stats = Substitute.For<IStatisticsService>();
        IServiceProvider services = GetServices(b => b.RegisterInstance(stats).As<IStatisticsService>());
        var controller = new StatisticsController(services.GetRequiredService<IStatisticsService>());

        var result = await controller.GetEvaluatorOverview(Guid.NewGuid(), from: null, to: null, cancellationToken: CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task GetEvaluatorSparklines_MissingProjectId_ReturnsBadRequest()
    {
        var stats = Substitute.For<IStatisticsService>();
        IServiceProvider services = GetServices(b => b.RegisterInstance(stats).As<IStatisticsService>());
        var controller = new StatisticsController(services.GetRequiredService<IStatisticsService>());

        var result = await controller.GetEvaluatorSparklines(projectId: null, from: DateTimeOffset.UtcNow, to: DateTimeOffset.UtcNow, cancellationToken: CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task GetTokenUsage_PassesFilter_AndMaps()
    {
        var stats = Substitute.For<IStatisticsService>();
        var endpointId = Guid.NewGuid();
        var date = DateOnly.FromDateTime(DateTime.UtcNow);
        stats.GetTokenUsageAsync(Arg.Any<StatisticsFilter>(), Arg.Any<CancellationToken>())
            .Returns([new TokenUsageStat(date, endpointId, 10, 20)]);

        IServiceProvider services = GetServices(b => b.RegisterInstance(stats).As<IStatisticsService>());
        var controller = new StatisticsController(services.GetRequiredService<IStatisticsService>());

        var result = await controller.GetTokenUsage(cancellationToken: CancellationToken);

        result.Should().ContainSingle();
        result[0].InputTokens.Should().Be(10);
        result[0].OutputTokens.Should().Be(20);
    }
}
