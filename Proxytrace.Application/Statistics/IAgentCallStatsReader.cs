namespace Proxytrace.Application.Statistics;

/// <summary>
/// Read-only aggregations over <c>AgentCallEntity</c> rows.
/// Insert-only call data aggregates cheaply at read time, so no projection table is required.
/// Consumed by <see cref="IDashboardStatistics"/> and <see cref="IAgentStatistics"/>; not part of the public read API.
/// </summary>
public interface IAgentCallStatsReader
{
    Task<StatisticsSummary> GetSummaryAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    /// <summary>Timestamp of the earliest matching call, or <c>null</c> when the filter matches nothing.</summary>
    Task<DateTimeOffset?> GetEarliestCallAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TokenUsageStat>> GetTokenUsageAsync(StatisticsFilter filter, StatisticsBucket bucket, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<LatencyStat>> GetLatencyAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ErrorRateStat>> GetErrorRatesAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ModelBreakdownStat>> GetModelBreakdownAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AgentBreakdownStat>> GetAgentBreakdownAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CostEstimateStat>> GetCostEstimateAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AgentTokenUsageStat>> GetTokenUsageByAgentAsync(StatisticsFilter filter, StatisticsBucket bucket, CancellationToken cancellationToken = default);

    Task<LiveTelemetry> GetLiveTelemetryAsync(StatisticsFilter filter, DateTimeOffset since, DateTimeOffset now, CancellationToken cancellationToken = default);

    Task<CallTrends> GetCallTrendsAsync(StatisticsFilter filter, int buckets, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AgentTimeSeriesPoint>> GetAgentTimeSeriesAsync(Guid agentId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<AgentTimeSeriesPoint> Series, AgentTimeSummary Summary)> GetAgentWindowAsync(
        Guid agentId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default);

    /// <summary>
    /// Distribution (mean ± std) of the agent's successful (2xx) calls over <paramref name="from"/>..<paramref name="to"/>.
    /// Token and latency metrics are per call; cost, cache-hit-rate and tool-call metrics are per conversation.
    /// </summary>
    Task<AgentCallDistributions> GetAgentDistributionsAsync(
        Guid agentId, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken = default);
}
