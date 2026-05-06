namespace Trsr.Domain;

/// <summary>
/// Query service for aggregated statistics across agent calls, test runs, and evaluations.
/// </summary>
public interface IStatisticsQueryService
{
    /// <summary>Returns high-level aggregate metrics for the given <paramref name="filter"/>.</summary>
    Task<StatisticsSummary> GetSummaryAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    /// <summary>Returns per-model, per-day token usage for the given <paramref name="filter"/>.</summary>
    Task<IReadOnlyList<TokenUsageStat>> GetTokenUsageAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    /// <summary>Returns latency percentile statistics grouped by model for the given <paramref name="filter"/>.</summary>
    Task<IReadOnlyList<LatencyStat>> GetLatencyAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    /// <summary>Returns pass/fail/undecided counts per agent run for the given <paramref name="filter"/>.</summary>
    Task<IReadOnlyList<PassRateStat>> GetPassRatesAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    /// <summary>Returns error rate statistics grouped by model and provider for the given <paramref name="filter"/>.</summary>
    Task<IReadOnlyList<ErrorRateStat>> GetErrorRatesAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    /// <summary>Returns call volume and token breakdown by model for the given <paramref name="filter"/>.</summary>
    Task<IReadOnlyList<ModelBreakdownStat>> GetModelBreakdownAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    /// <summary>Returns estimated USD cost per model for the given <paramref name="filter"/>.</summary>
    Task<IReadOnlyList<CostEstimateStat>> GetCostEstimateAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    /// <summary>Aggregate test-run KPIs for all finalized runs in the given test run group.</summary>
    Task<TestRunStatistics> GetStatisticsByGroupAsync(Guid groupId, CancellationToken cancellationToken = default);

    /// <summary>Aggregate test-run KPIs for all finalized runs associated with the given agent.</summary>
    Task<TestRunStatistics> GetStatisticsByAgentAsync(Guid agentId, CancellationToken cancellationToken = default);

    /// <summary>Aggregate test-run KPIs for all finalized runs matching the filter (used by the dashboard).</summary>
    Task<TestRunStatistics> GetStatisticsAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);
}

public record StatisticsFilter(
    DateTimeOffset? From = null,
    DateTimeOffset? To = null,
    Guid? ProjectId = null,
    Guid? AgentId = null,
    Guid? EndpointId = null);

public record StatisticsSummary(
    long TotalCalls,
    long TotalInputTokens,
    long TotalOutputTokens,
    double AvgLatencyMs,
    double OverallPassRate);

public record TokenUsageStat(
    DateOnly Date,
    Guid EndpointId,
    long InputTokens,
    long OutputTokens);

public record LatencyStat(
    Guid EndpointId,
    double P50Ms,
    double P95Ms,
    double P99Ms,
    double MinMs,
    double MaxMs,
    int SampleCount);

public record PassRateStat(
    Guid SuiteId,
    DateTimeOffset RunTimestamp,
    int PassCount,
    int FailCount,
    int UndecidedCount);

public record ErrorRateStat(
    Guid EndpointId,
    int TotalCalls,
    int ErrorCalls,
    double ErrorRate);

public record ModelBreakdownStat(
    Guid EndpointId,
    string ModelName,
    int CallCount,
    long TotalInputTokens,
    long TotalOutputTokens,
    double AvgDurationMs);

public record CostEstimateStat(
    Guid EndpointId,
    decimal? InputCostEur,
    decimal? OutputCostEur,
    decimal? TotalCostEur);

public record TestRunStatistics(
    int TestCases,
    int Passed,
    TimeSpan TotalDuration,
    long TotalTokens,
    decimal? TotalCost)
{
    public static TestRunStatistics Empty => new(0, 0, TimeSpan.Zero, 0, null);
}
