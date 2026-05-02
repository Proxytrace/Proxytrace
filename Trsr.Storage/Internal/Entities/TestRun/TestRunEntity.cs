using Trsr.Domain.TestRun;

namespace Trsr.Storage.Internal.Entities.TestRun;

[StoredDomainEntity(typeof(ITestRun))]
internal record TestRunEntity : Entity
{
    public required Guid Suite { get; init; }
    public required Guid Endpoint { get; init; }
    public required TestRunStatus Status { get; init; }
    public DateTimeOffset? CompletedAt { get; init; }
    public required IReadOnlyCollection<Guid> TestResults { get; init; }
}
