namespace Proxytrace.Application.Statistics;

/// <summary>
/// Public read facade for the statistics dashboard. Exclusively consumed by the API controllers.
/// </summary>
public interface IStatisticsService
{
    Task<StatisticsSummary> GetSummaryAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    /// <summary>
    /// Composes the entire dashboard payload in a single call by fanning out to the granular
    /// statistics readers in parallel. Replaces the client's per-widget request waterfall.
    /// </summary>
    Task<DashboardView> GetDashboardViewAsync(StatisticsFilter filter, int recentTraceCount, int agentLimit, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TokenUsageStat>> GetTokenUsageAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<LatencyStat>> GetLatencyAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PassRateStat>> GetPassRatesAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ErrorRateStat>> GetErrorRatesAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ModelBreakdownStat>> GetModelBreakdownAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AgentBreakdownStat>> GetAgentBreakdownAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<LiveTelemetry> GetLiveTelemetryAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AgentTokenUsageStat>> GetTokenUsageByAgentAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<DashboardTrends> GetDashboardTrendsAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CostEstimateStat>> GetCostEstimateAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<AgentOverviewStat> GetAgentOverviewAsync(Guid agentId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AgentTimeSeriesPoint>> GetAgentTimeSeriesAsync(Guid agentId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AgentPassRatePoint>> GetAgentPassRateTrendAsync(Guid agentId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AgentSuitePassRate>> GetAgentLatestSuitePassRatesAsync(Guid agentId, CancellationToken cancellationToken = default);

    Task<AgentEntityCounts> GetAgentEntityCountsAsync(Guid agentId, CancellationToken cancellationToken = default);

    Task<EvaluatorOverviewStat> GetEvaluatorOverviewAsync(Guid evaluatorId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<EvaluatorSparklineStat>> GetEvaluatorSparklinesAsync(Guid projectId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default);
}
