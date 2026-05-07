namespace Trsr.Api.Dto.Projects;

public record ProjectDto(
    Guid Id,
    string Name,
    Guid OrganizationId,
    string OrganizationName,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record CreateProjectRequest(
    string Name,
    Guid SystemEndpointId,
    Guid OrganizationId);

public record UpdateProjectRequest(
    string Name,
    Guid SystemEndpointId);
