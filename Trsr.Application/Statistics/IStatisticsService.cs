namespace Trsr.Application.Statistics;

/// <summary>
/// Public read facade for the statistics dashboard. Exclusively consumed by the API controllers.
/// </summary>
public interface IStatisticsService
{
    Task<StatisticsSummary> GetSummaryAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TokenUsageStat>> GetTokenUsageAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<LatencyStat>> GetLatencyAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PassRateStat>> GetPassRatesAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ErrorRateStat>> GetErrorRatesAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ModelBreakdownStat>> GetModelBreakdownAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AgentBreakdownStat>> GetAgentBreakdownAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CostEstimateStat>> GetCostEstimateAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<AgentOverviewStat> GetAgentOverviewAsync(Guid agentId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AgentTimeSeriesPoint>> GetAgentTimeSeriesAsync(Guid agentId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AgentPassRatePoint>> GetAgentPassRateTrendAsync(Guid agentId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AgentSuitePassRate>> GetAgentLatestSuitePassRatesAsync(Guid agentId, CancellationToken cancellationToken = default);

    Task<AgentEntityCounts> GetAgentEntityCountsAsync(Guid agentId, CancellationToken cancellationToken = default);
}
