using Trsr.Domain.TestRun;

namespace Trsr.Storage.Internal.Entities.TestRun;

[StoredDomainEntity(typeof(ITestRun))]
internal record TestRunEntity : Entity
{
    public required Guid Group { get; init; }
    public required Guid Endpoint { get; init; }
    public required TestRunStatus Status { get; init; }
    public DateTimeOffset? CompletedAt { get; init; }
    public required IReadOnlyCollection<Guid> TestResults { get; init; }

    public required int StatTestCases { get; init; }
    public required int StatPassed { get; init; }
    public required long StatInputTokens { get; init; }
    public required long StatOutputTokens { get; init; }
    public required long StatTotalDurationMs { get; init; }
    public required decimal? StatCost { get; init; }
}
