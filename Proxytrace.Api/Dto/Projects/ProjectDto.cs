using System.ComponentModel.DataAnnotations;

namespace Proxytrace.Api.Dto.Projects;

public record ProjectDto(
    Guid Id,
    string Name,
    Guid SystemEndpointId,
    IReadOnlyList<ProjectMemberDto> Members,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record ProjectMemberDto(Guid Id, string Email);

public record CreateProjectRequest(
    [Required, StringLength(200, MinimumLength = 1)] string Name,
    [Required] Guid SystemEndpointId,
    IReadOnlyList<Guid>? MemberIds = null);

public record UpdateProjectRequest(
    [Required, StringLength(200, MinimumLength = 1)] string Name,
    [Required] Guid SystemEndpointId,
    IReadOnlyList<Guid>? MemberIds = null);
