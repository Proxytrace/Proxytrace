using Trsr.Domain.TestRun;
using Trsr.Domain.TestRunGroup;

namespace Trsr.Storage.Internal.Entities.TestRunGroup;

[StoredDomainEntity(typeof(ITestRunGroup))]
internal record TestRunGroupEntity : Entity
{
    public required Guid Suite { get; init; }
    public required TestRunStatus Status { get; init; }
    public DateTimeOffset? CompletedAt { get; init; }
}
