namespace Trsr.Api.Dto.Statistics;

public record SummaryDto(
    long TotalCalls,
    long TotalInputTokens,
    long TotalOutputTokens,
    double AvgLatencyMs,
    double OverallPassRate);

public record TokenUsageDto(DateOnly Date, string Model, long InputTokens, long OutputTokens);

public record LatencyDto(string Model, double P50Ms, double P95Ms, double P99Ms, double MinMs, double MaxMs, int SampleCount);

public record PassRateDto(Guid AgentId, DateTimeOffset RunTimestamp, int PassCount, int FailCount, int UndecidedCount);

public record ErrorRateDto(string Model, string Provider, int TotalCalls, int ErrorCalls, double ErrorRate);

public record ModelBreakdownDto(string Model, int CallCount, long TotalInputTokens, long TotalOutputTokens, double AvgDurationMs);

public record CostEstimateDto(string Model, decimal InputCostUsd, decimal OutputCostUsd, decimal TotalCostUsd);
