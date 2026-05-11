namespace Trsr.Api.Dto.Projects;

public record ProjectDto(
    Guid Id,
    string Name,
    Guid SystemEndpointId,
    IReadOnlyList<ProjectMemberDto> Members,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record ProjectMemberDto(Guid Id, string Email);

public record CreateProjectRequest(
    string Name,
    Guid SystemEndpointId,
    IReadOnlyList<Guid>? MemberIds = null);

public record UpdateProjectRequest(
    string Name,
    Guid SystemEndpointId,
    IReadOnlyList<Guid>? MemberIds = null);
