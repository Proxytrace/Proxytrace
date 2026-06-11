using System.ComponentModel.DataAnnotations;

namespace Proxytrace.Api.Dto.Projects;

public record ProjectDto(
    Guid Id,
    string Name,
    Guid SystemEndpointId,
    IReadOnlyList<ProjectMemberDto> Members,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

/// <summary>
/// Lightweight project projection for the projects list / app-wide project selector. Replaces the
/// fat <see cref="ProjectDto"/>'s member list with a count; full members are fetched per-selection
/// via <c>GET /api/projects/{id}</c> (or <c>/members</c>).
/// </summary>
public record ProjectListItemDto(
    Guid Id,
    string Name,
    Guid SystemEndpointId,
    int MemberCount,
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
