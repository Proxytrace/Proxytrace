using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Application.Statistics;
using Proxytrace.Domain;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Testing;

namespace Proxytrace.Storage.Tests;

[TestClass]
public sealed class AgentCallStatsQueriesTests : BaseTest<Module>
{
    [TestMethod]
    public async Task GetSummary_EmptyDb_ReturnsZeros()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();

        var summary = await reader.GetSummaryAsync(new StatisticsFilter(), CancellationToken);

        summary.TotalCalls.Should().Be(0);
        summary.TotalInputTokens.Should().Be(0);
        summary.TotalOutputTokens.Should().Be(0);
        summary.AvgLatencyMs.Should().Be(0);
    }

    [TestMethod]
    public async Task GetSummary_AfterSeedingCalls_AggregatesTotals()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();
        var gen = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();
        await gen.CreateAsync(CancellationToken);
        await gen.CreateAsync(CancellationToken);

        var summary = await reader.GetSummaryAsync(new StatisticsFilter(), CancellationToken);

        summary.TotalCalls.Should().Be(2);
    }

    [TestMethod]
    public async Task GetTokenUsage_AggregatesPerEndpointPerDate()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();
        var gen = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();
        await gen.CreateAsync(CancellationToken);

        var rows = await reader.GetTokenUsageAsync(new StatisticsFilter(), CancellationToken);

        rows.Should().NotBeEmpty();
    }

    [TestMethod]
    public async Task GetErrorRates_EmptyDb_ReturnsEmpty()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();

        var rows = await reader.GetErrorRatesAsync(new StatisticsFilter(), CancellationToken);

        rows.Should().BeEmpty();
    }

    [TestMethod]
    public async Task GetAgentBreakdown_EmptyDb_ReturnsEmpty()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();

        var rows = await reader.GetAgentBreakdownAsync(new StatisticsFilter(), CancellationToken);

        rows.Should().BeEmpty();
    }

    [TestMethod]
    public async Task GetCostEstimate_EmptyDb_ReturnsEmpty()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();

        var rows = await reader.GetCostEstimateAsync(new StatisticsFilter(), CancellationToken);

        rows.Should().BeEmpty();
    }

    [TestMethod]
    public async Task GetLatency_EmptyDb_ReturnsEmpty()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();

        var rows = await reader.GetLatencyAsync(new StatisticsFilter(), CancellationToken);

        rows.Should().BeEmpty();
    }

    [TestMethod]
    public async Task GetModelBreakdown_AfterSeed_ReturnsRowPerEndpoint()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();
        var gen = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();
        await gen.CreateAsync(CancellationToken);

        var rows = await reader.GetModelBreakdownAsync(new StatisticsFilter(), CancellationToken);

        rows.Should().NotBeEmpty();
        rows[0].CallCount.Should().BeGreaterThan(0);
    }

    [TestMethod]
    public async Task GetSummary_FilteredByUnknownAgent_ReturnsZeros()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();
        var gen = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();
        await gen.CreateAsync(CancellationToken);

        var summary = await reader.GetSummaryAsync(new StatisticsFilter(AgentId: Guid.NewGuid()), CancellationToken);

        summary.TotalCalls.Should().Be(0);
    }

    [TestMethod]
    public async Task GetAgentWindow_NoMatches_ReturnsEmptySeriesAndZeroSummary()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IAgentCallStatsReader>();

        var (series, summary) = await reader.GetAgentWindowAsync(
            Guid.NewGuid(),
            DateTimeOffset.UtcNow.AddDays(-1),
            DateTimeOffset.UtcNow,
            StatisticsBucket.Daily,
            CancellationToken);

        series.Should().BeEmpty();
        summary.TotalTraces.Should().Be(0);
    }
}
