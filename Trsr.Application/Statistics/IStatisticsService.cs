namespace Trsr.Application.Statistics;

/// <summary>
/// Read API for aggregated statistics across agent calls, test runs, and evaluations.
/// Lives on the Application layer; consumers (controllers, optimizers) depend on this only.
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

    /// <summary>Per-run projection for a single finalized run, or null if not (yet) computed.</summary>
    Task<TestRunStats?> GetTestRunStatsAsync(Guid testRunId, CancellationToken cancellationToken = default);

    /// <summary>All per-run projections in the given group (for cross-run diffs in optimizers).</summary>
    Task<IReadOnlyList<TestRunStats>> GetTestRunStatsByGroupAsync(Guid groupId, CancellationToken cancellationToken = default);

    Task<TestRunStatsAggregate> GetStatisticsByGroupAsync(Guid groupId, CancellationToken cancellationToken = default);

    Task<TestRunStatsAggregate> GetStatisticsByAgentAsync(Guid agentId, CancellationToken cancellationToken = default);

    Task<TestRunStatsAggregate> GetStatisticsAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<AgentOverviewStat> GetAgentOverviewAsync(Guid agentId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AgentTimeSeriesPoint>> GetAgentTimeSeriesAsync(Guid agentId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AgentPassRatePoint>> GetAgentPassRateTrendAsync(Guid agentId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AgentSuitePassRate>> GetAgentLatestSuitePassRatesAsync(Guid agentId, CancellationToken cancellationToken = default);

    Task<AgentEntityCounts> GetAgentEntityCountsAsync(Guid agentId, CancellationToken cancellationToken = default);
}
