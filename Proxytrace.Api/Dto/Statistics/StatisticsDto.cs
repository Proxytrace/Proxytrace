using Proxytrace.Api.Dto.AgentCalls;
using Proxytrace.Api.Dto.Agents;

namespace Proxytrace.Api.Dto.Statistics;

/// <summary>
/// Single-call payload for the dashboard page; bundles every widget's data so the client
/// makes one request instead of fanning out across the granular statistics endpoints.
/// </summary>
public record DashboardViewDto(
    SummaryDto Summary,
    LiveTelemetryDto LiveTelemetry,
    DashboardTrendsDto Trends,
    IReadOnlyList<AgentBreakdownDto> AgentBreakdown,
    IReadOnlyList<LatencyDto> Latency,
    IReadOnlyList<ModelBreakdownDto> ModelBreakdown,
    IReadOnlyList<TokenUsageDto> TokenUsage,
    IReadOnlyList<AgentTokenUsageDto> TokenUsageByAgent,
    /// <summary>Bucket granularity used for the token series, e.g. "fiveMinutes", "hourly", "daily".</summary>
    string TokenBucket,
    IReadOnlyList<AgentCallListItemDto> RecentTraces,
    IReadOnlyList<AgentListItemDto> Agents);

public record SummaryDto(
    long TotalCalls,
    long TotalInputTokens,
    long TotalOutputTokens,
    long TotalCachedInputTokens,
    double AvgLatencyMs,
    double? OverallPassRate);

public record TokenUsageDto(DateTimeOffset BucketStart, Guid EndPointId, long InputTokens, long OutputTokens, long CachedInputTokens);

public record LatencyDto(Guid EndpointId, double P50Ms, double P95Ms, double P99Ms, double MinMs, double MaxMs, int SampleCount);

public record ModelBreakdownDto(Guid EndpointId, string ModelName, int CallCount, long TotalInputTokens, long TotalOutputTokens, long TotalCachedInputTokens, double AvgDurationMs);

public record AgentBreakdownDto(Guid AgentId, int CallCount);

public record LiveTelemetryDto(
    double TracesPerMinute,
    double TokensPerSecond,
    int QueueDepth,
    double ErrorRate,
    double P95Ms,
    string ProxyVersion);

public record AgentTokenUsageDto(DateTimeOffset BucketStart, Guid AgentId, long InputTokens, long OutputTokens, long CachedInputTokens);

public record DashboardTrendsDto(
    IReadOnlyList<double> Traces,
    IReadOnlyList<double> LatencyMs,
    IReadOnlyList<double> Throughput,
    IReadOnlyList<double> PassRate);

public record AgentTimeSeriesPointDto(
    DateTimeOffset BucketStart,
    int TraceCount,
    long InputTokens,
    long OutputTokens,
    long CachedInputTokens,
    decimal CostEur,
    double AvgLatencyMs);

public record AgentPassRatePointDto(
    DateTimeOffset BucketStart,
    int Passed,
    int TestCases);

public record AgentSuitePassRateDto(
    Guid SuiteId,
    string SuiteName,
    DateTimeOffset LatestRunAt,
    int Passed,
    int TestCases);

public record AgentEntityCountsDto(
    int SuiteCount,
    int TestCaseCount,
    int OpenProposalCount,
    int TotalProposalCount);

public record AgentTimeSummaryDto(
    int TotalTraces,
    long TotalInputTokens,
    long TotalOutputTokens,
    long TotalCachedInputTokens,
    decimal TotalCostEur,
    double AvgLatencyMs);

public record AgentOverviewDto(
    AgentTimeSummaryDto Summary,
    IReadOnlyList<AgentTimeSeriesPointDto> TimeSeries,
    IReadOnlyList<AgentPassRatePointDto> PassRateTrend,
    IReadOnlyList<AgentSuitePassRateDto> SuitePassRates,
    AgentEntityCountsDto Counts);

public record MetricDistributionDto(
    double Mean,
    double StdDev,
    int SampleCount);

public record AgentDistributionsDto(
    MetricDistributionDto InputTokensPerCall,
    MetricDistributionDto OutputTokensPerCall,
    MetricDistributionDto LatencyMsPerCall,
    MetricDistributionDto CostPerConversationEur,
    MetricDistributionDto CacheHitRatePerConversation,
    MetricDistributionDto ToolCallsPerConversation);

public record EvaluatorSummaryDto(
    int TotalEvaluations,
    double? AvgScore,
    double? OverallPassRate,
    long? InputTokens,
    long? OutputTokens,
    long? CachedInputTokens,
    decimal? TotalCost,
    double? AvgLatencyMs);

public record EvaluatorPassRatePointDto(
    DateTimeOffset BucketStart,
    int Passed,
    int Total);

public record EvaluatorScoreBucketDto(
    string Score,
    int Count);

public record EvaluatorCostPointDto(
    DateTimeOffset BucketStart,
    long InputTokens,
    long OutputTokens,
    long CachedInputTokens,
    decimal Cost,
    double AvgLatencyMs);

public record EvaluatorOverviewDto(
    EvaluatorSummaryDto Summary,
    IReadOnlyList<EvaluatorPassRatePointDto> PassRateTrend,
    IReadOnlyList<EvaluatorScoreBucketDto> ScoreDistribution,
    IReadOnlyList<EvaluatorCostPointDto> CostTrend);

public record EvaluatorSparklineDto(
    Guid EvaluatorId,
    IReadOnlyList<EvaluatorPassRatePointDto> Points);
