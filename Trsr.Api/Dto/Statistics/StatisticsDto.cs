namespace Trsr.Api.Dto.Statistics;

public record SummaryDto(
    long TotalCalls,
    long TotalInputTokens,
    long TotalOutputTokens,
    double AvgLatencyMs,
    double? OverallPassRate);

public record TokenUsageDto(DateOnly Date, Guid EndPointId, long InputTokens, long OutputTokens);

public record LatencyDto(Guid EndpointId, double P50Ms, double P95Ms, double P99Ms, double MinMs, double MaxMs, int SampleCount);

public record PassRateDto(Guid SuiteId, DateTimeOffset RunTimestamp, int PassCount, int FailCount);

public record ErrorRateDto(Guid EndpointId, int TotalCalls, int ErrorCalls, double ErrorRate);

public record ModelBreakdownDto(Guid EndpointId, string ModelName, int CallCount, long TotalInputTokens, long TotalOutputTokens, double AvgDurationMs);

public record AgentBreakdownDto(Guid AgentId, int CallCount);

public record CostEstimateDto(Guid EndpointId, decimal? InputCostEur, decimal? OutputCostEur, decimal? TotalCostEur);

public record AgentTimeSeriesPointDto(
    DateTimeOffset BucketStart,
    int TraceCount,
    long InputTokens,
    long OutputTokens,
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
    decimal TotalCostEur,
    double AvgLatencyMs);

public record AgentOverviewDto(
    AgentTimeSummaryDto Summary,
    IReadOnlyList<AgentTimeSeriesPointDto> TimeSeries,
    IReadOnlyList<AgentPassRatePointDto> PassRateTrend,
    IReadOnlyList<AgentSuitePassRateDto> SuitePassRates,
    AgentEntityCountsDto Counts);
