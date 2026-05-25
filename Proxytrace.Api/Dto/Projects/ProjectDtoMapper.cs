using Proxytrace.Domain.Project;
using Proxytrace.Domain.User;

namespace Proxytrace.Api.Dto.Projects;

/// <summary>
/// Maps <see cref="IProject"/> domain entities to <see cref="ProjectDto"/>.
/// Shared by the projects controller and aggregate view endpoints.
/// </summary>
internal static class ProjectDtoMapper
{
    public static ProjectDto ToDto(IProject p) =>
        new(p.Id,
            p.Name,
            p.SystemEndpoint.Id,
            p.Members.Select(ToMemberDto).ToArray(),
            p.CreatedAt,
            p.UpdatedAt);

    public static ProjectMemberDto ToMemberDto(IUser user) =>
        new(user.Id, user.Email);
}
