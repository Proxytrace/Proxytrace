using Trsr.Domain.TestRun;

namespace Trsr.Storage.Internal.Entities.TestRun;

[StoredDomainEntity(typeof(ITestRun))]
internal record TestRunEntity : Entity
{
    public required DateTimeOffset Timestamp { get; init; }
    public required Guid Agent { get; init; }
    public required IReadOnlyCollection<Guid> TestResults { get; init; }
}
