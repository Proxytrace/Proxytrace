namespace Trsr.Domain;

public interface IStatisticsQueryService
{
    Task<StatisticsSummary> GetSummaryAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TokenUsageStat>> GetTokenUsageAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<LatencyStat>> GetLatencyAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PassRateStat>> GetPassRatesAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ErrorRateStat>> GetErrorRatesAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ModelBreakdownStat>> GetModelBreakdownAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CostEstimateStat>> GetCostEstimateAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);
}

public record StatisticsFilter(
    DateTimeOffset? From = null,
    DateTimeOffset? To = null,
    Guid? ProjectId = null,
    Guid? AgentId = null,
    string? Model = null);

public record StatisticsSummary(
    long TotalCalls,
    long TotalInputTokens,
    long TotalOutputTokens,
    double AvgLatencyMs,
    double OverallPassRate);

public record TokenUsageStat(
    DateOnly Date,
    string Model,
    long InputTokens,
    long OutputTokens);

public record LatencyStat(
    string Model,
    double P50Ms,
    double P95Ms,
    double P99Ms,
    double MinMs,
    double MaxMs,
    int SampleCount);

public record PassRateStat(
    Guid AgentId,
    DateTimeOffset RunTimestamp,
    int PassCount,
    int FailCount,
    int UndecidedCount);

public record ErrorRateStat(
    string Model,
    string Provider,
    int TotalCalls,
    int ErrorCalls,
    double ErrorRate);

public record ModelBreakdownStat(
    string Model,
    int CallCount,
    long TotalInputTokens,
    long TotalOutputTokens,
    double AvgDurationMs);

public record CostEstimateStat(
    string Model,
    decimal InputCostUsd,
    decimal OutputCostUsd,
    decimal TotalCostUsd);
