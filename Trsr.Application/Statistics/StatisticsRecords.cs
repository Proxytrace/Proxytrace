using Trsr.Domain.Usage;

namespace Trsr.Application.Statistics;

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
    double? OverallPassRate);

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
    int FailCount);

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

public record AgentBreakdownStat(
    Guid AgentId,
    int CallCount);

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

public record EvaluatorSummary(
    int TotalEvaluations,
    double? AvgScore,
    double? OverallPassRate,
    long? InputTokens,
    long? OutputTokens,
    decimal? TotalCostEur);

public record EvaluatorPassRatePoint(
    DateTimeOffset BucketStart,
    int Passed,
    int Total);

public record EvaluatorScoreBucket(
    string Score,
    int Count);

public record EvaluatorOverviewStat(
    EvaluatorSummary Summary,
    IReadOnlyList<EvaluatorPassRatePoint> PassRateTrend,
    IReadOnlyList<EvaluatorScoreBucket> ScoreDistribution);

public record EvaluatorSparklineStat(
    Guid EvaluatorId,
    IReadOnlyList<EvaluatorPassRatePoint> Points);



/// <summary>
/// Aggregate KPI rollup across multiple test runs.
/// </summary>
public record TestRunStatsAggregate(
    int TestCases,
    int Passed,
    TimeSpan? TotalDuration,
    TokenUsage? Usage,
    decimal? Cost)
{
    public int Failed => TestCases - Passed;

    public double? PassRate
        => TestCases > 0 ? Passed / (double)TestCases : null;

    public static TestRunStatsAggregate Empty => new(
        TestCases: 0,
        Passed: 0,
        TotalDuration: null,
        Usage: null,
        Cost: null);

    public static TestRunStatsAggregate operator -(TestRunStatsAggregate a, TestRunStatsAggregate b) =>
        new(
            TestCases: a.TestCases - b.TestCases,
            Passed: a.Passed - b.Passed,
            TotalDuration: a.TotalDuration.HasValue && b.TotalDuration.HasValue
                ? a.TotalDuration.Value - b.TotalDuration.Value
                : null,
            Usage: a.Usage != null && b.Usage != null ? a.Usage - b.Usage : null,
            Cost: a.Cost.HasValue && b.Cost.HasValue ? a.Cost.Value - b.Cost.Value : null);
}
