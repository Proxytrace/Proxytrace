namespace Proxytrace.Api.Dto.TestRuns;

public record ScheduleEndpointDto(Guid Id, string Name);

public record TestRunScheduleDto(
    Guid Id, string Name, Guid SuiteId, string SuiteName, Guid AgentId, string AgentName,
    IReadOnlyList<ScheduleEndpointDto> Endpoints, int IntervalMinutes, bool IsEnabled,
    DateTimeOffset AnchorAt, DateTimeOffset NextRunAt, DateTimeOffset? LastRunAt,
    IReadOnlyList<TestRunGroupListItemDto> RecentRuns,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

/// <summary><c>AnchorAt</c> phases the recurrence (e.g. the daily run time). When null the schedule
/// anchors to "now", reproducing the legacy "first run one interval from creation" behaviour.</summary>
public record CreateTestRunScheduleRequest(
    string Name, Guid TestSuiteId, IReadOnlyList<Guid> ModelEndpointIds, int IntervalMinutes, bool Enabled,
    DateTimeOffset? AnchorAt = null);

public record UpdateTestRunScheduleRequest(
    string Name, IReadOnlyList<Guid> ModelEndpointIds, int IntervalMinutes, bool Enabled,
    DateTimeOffset? AnchorAt = null);
