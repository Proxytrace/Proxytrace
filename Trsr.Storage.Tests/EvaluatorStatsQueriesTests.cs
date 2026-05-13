using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Application.Statistics;
using Trsr.Testing;

namespace Trsr.Storage.Tests;

[TestClass]
public sealed class EvaluatorStatsQueriesTests : BaseTest<Module>
{
    private static readonly DateTimeOffset From = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset To = From.AddDays(30);

    [TestMethod]
    public async Task GetOverview_NoData_ReturnsZeroedStats()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IEvaluatorStatsReader>();

        var result = await reader.GetOverviewAsync(Guid.NewGuid(), From, To, StatisticsBucket.Daily, CancellationToken);

        result.Summary.TotalEvaluations.Should().Be(0);
        result.PassRateTrend.Should().BeEmpty();
        result.ScoreDistribution.Should().BeEmpty();
    }

    [TestMethod]
    public async Task GetSparklines_NoEvaluatorsInProject_ReturnsEmpty()
    {
        IServiceProvider services = GetServices();
        var reader = services.GetRequiredService<IEvaluatorStatsReader>();

        var result = await reader.GetSparklinesAsync(Guid.NewGuid(), From, To, StatisticsBucket.Daily, CancellationToken);

        result.Should().BeEmpty();
    }
}
