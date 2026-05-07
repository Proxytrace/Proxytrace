namespace Trsr.Api.Dto.Projects;

public record ProjectDto(
    Guid Id,
    string Name,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record CreateProjectRequest(string Name);

public record UpdateProjectRequest(string Name);
