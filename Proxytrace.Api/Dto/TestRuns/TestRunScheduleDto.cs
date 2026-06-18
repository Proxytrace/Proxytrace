namespace Proxytrace.Api.Dto.TestRuns;

public record ScheduleEndpointDto(Guid Id, string Name);

public record TestRunScheduleDto(
    Guid Id, string Name, Guid SuiteId, string SuiteName, Guid AgentId, string AgentName,
    IReadOnlyList<ScheduleEndpointDto> Endpoints, int IntervalMinutes, bool IsEnabled,
    DateTimeOffset NextRunAt, DateTimeOffset? LastRunAt,
    IReadOnlyList<TestRunGroupListItemDto> RecentRuns,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

public record CreateTestRunScheduleRequest(
    string Name, Guid TestSuiteId, IReadOnlyList<Guid> ModelEndpointIds, int IntervalMinutes, bool Enabled);

public record UpdateTestRunScheduleRequest(
    string Name, IReadOnlyList<Guid> ModelEndpointIds, int IntervalMinutes, bool Enabled);
