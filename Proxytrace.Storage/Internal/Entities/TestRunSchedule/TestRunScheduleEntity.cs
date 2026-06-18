using Proxytrace.Domain.TestRunSchedule;

namespace Proxytrace.Storage.Internal.Entities.TestRunSchedule;

[StoredDomainEntity(typeof(ITestRunSchedule))]
internal record TestRunScheduleEntity : Entity
{
    public required string Name { get; init; }
    public required Guid Suite { get; init; }
    public required int IntervalMinutes { get; init; }
    public required bool IsEnabled { get; init; }
    public required DateTimeOffset NextRunAt { get; init; }
    public DateTimeOffset? LastRunAt { get; init; }
    public required ICollection<TestRunScheduleEndpointEntity> ScheduleEndpoints { get; init; }
}
