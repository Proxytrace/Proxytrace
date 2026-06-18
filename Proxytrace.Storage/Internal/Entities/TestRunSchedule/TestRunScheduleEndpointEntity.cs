namespace Proxytrace.Storage.Internal.Entities.TestRunSchedule;

/// <summary>
/// Join table for the N:M between schedules and endpoints. Storage-only, no domain counterpart.
/// </summary>
internal record TestRunScheduleEndpointEntity
{
    public required Guid ScheduleId { get; init; }
    public required Guid EndpointId { get; init; }
}
