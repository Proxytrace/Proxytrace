namespace Trsr.Api.Dto.Projects;

public record ProjectDto(
    Guid Id,
    string Name,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record CreateProjectRequest(
    string Name,
    Guid SystemEndpointId);

public record UpdateProjectRequest(
    string Name,
    Guid SystemEndpointId);
