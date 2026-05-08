using Trsr.Domain.Usage;

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

    /// <summary>Combined per-agent rollup: summary KPIs, time-series, pass-rate trend, latest suite pass rates, and entity counts.</summary>
    Task<AgentOverviewStat> GetAgentOverviewAsync(Guid agentId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default);

    /// <summary>Per-agent time-series of trace count, tokens, cost, and average latency, bucketed by <paramref name="bucket"/>.</summary>
    Task<IReadOnlyList<AgentTimeSeriesPoint>> GetAgentTimeSeriesAsync(Guid agentId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default);

    /// <summary>Per-agent pass-rate trend bucketed over completed test runs.</summary>
    Task<IReadOnlyList<AgentPassRatePoint>> GetAgentPassRateTrendAsync(Guid agentId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default);

    /// <summary>Latest finalized run per suite for the given agent.</summary>
    Task<IReadOnlyList<AgentSuitePassRate>> GetAgentLatestSuitePassRatesAsync(Guid agentId, CancellationToken cancellationToken = default);

    /// <summary>Counts of suites, test cases, and proposals (open/total) for the given agent.</summary>
    Task<AgentEntityCounts> GetAgentEntityCountsAsync(Guid agentId, CancellationToken cancellationToken = default);
}

public enum StatisticsBucket
{
    FiveMinutes,
    Hourly,
    Daily,
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
    long? InputTokens,
    long? OutputTokens);

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
    long? TotalInputTokens,
    long? TotalOutputTokens,
    double? AvgDurationMs);

public record CostEstimateStat(
    Guid EndpointId,
    decimal? InputCostEur,
    decimal? OutputCostEur,
    decimal? TotalCostEur);

public record AgentTimeSeriesPoint(
    DateTimeOffset BucketStart,
    int TraceCount,
    long InputTokens,
    long OutputTokens,
    decimal CostEur,
    double AvgLatencyMs);

public record AgentPassRatePoint(
    DateTimeOffset BucketStart,
    int Passed,
    int TestCases);

public record AgentSuitePassRate(
    Guid SuiteId,
    string SuiteName,
    DateTimeOffset LatestRunAt,
    int Passed,
    int TestCases);

public record AgentEntityCounts(
    int SuiteCount,
    int TestCaseCount,
    int OpenProposalCount,
    int TotalProposalCount);

public record AgentTimeSummary(
    int TotalTraces,
    long TotalInputTokens,
    long TotalOutputTokens,
    decimal TotalCostEur,
    double AvgLatencyMs);

public record AgentOverviewStat(
    AgentTimeSummary Summary,
    IReadOnlyList<AgentTimeSeriesPoint> TimeSeries,
    IReadOnlyList<AgentPassRatePoint> PassRateTrend,
    IReadOnlyList<AgentSuitePassRate> SuitePassRates,
    AgentEntityCounts Counts);

public record TestRunStatistics(
    int TestCases,
    int Passed,
    TimeSpan? TotalDuration,
    TokenUsage? TotalUsage,
    decimal? TotalCost)
{
    public static TestRunStatistics Empty => new(
        TestCases: 0,
        Passed: 0,
        TotalDuration: null,
        TotalUsage: null, 
        TotalCost: null);
}
