namespace Trsr.Storage.Internal.Entities.Statistics;

internal record TestRunStatsEntity : Entity
{
    public required Guid TestRunId { get; init; }
    public required Guid AgentId { get; init; }
    public required Guid EndpointId { get; init; }
    public required Guid GroupId { get; init; }
    public required Guid SuiteId { get; init; }
    public required int TestCases { get; init; }
    public required int Passed { get; init; }
    public long? InputTokens { get; init; }
    public long? OutputTokens { get; init; }
    public long? TotalDurationMicroseconds { get; init; }
    public decimal? Cost { get; init; }
    public required DateTimeOffset RunCompletedAt { get; init; }
}
