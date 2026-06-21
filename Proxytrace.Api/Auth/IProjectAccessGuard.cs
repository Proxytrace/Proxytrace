using Proxytrace.Application.Auth;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.User;

namespace Proxytrace.Api.Auth;

/// <summary>
/// Central cross-tenant authorization check. The app is multi-tenant: every resource belongs to a
/// <see cref="IProject"/>, users belong to projects via <c>Project.Members</c>, and the
/// <see cref="UserRole.Admin"/> role bypasses membership. Controllers resolve the owning project id
/// of the resource they are about to read/mutate and ask this guard whether the caller may touch it,
/// rather than trusting a raw route/query id (which is the IDOR fixed in #193).
/// </summary>
public interface IProjectAccessGuard
{
    /// <summary>True if the caller is an admin or a member of <paramref name="projectId"/>.</summary>
    Task<bool> CanAccessProjectAsync(Guid projectId, CancellationToken cancellationToken = default);

    /// <summary>
    /// The set of project ids the caller may see, or <c>null</c> for an admin (who may see all).
    /// Used to scope list endpoints: a non-admin is restricted to their member projects instead of
    /// receiving every tenant's rows when an optional <c>projectId</c> filter is omitted.
    /// </summary>
    Task<IReadOnlyCollection<Guid>?> GetAccessibleProjectIdsAsync(CancellationToken cancellationToken = default);
}

internal sealed class ProjectAccessGuard : IProjectAccessGuard
{
    private readonly ICurrentUserAccessor currentUser;
    private readonly IProjectRepository projects;

    public ProjectAccessGuard(ICurrentUserAccessor currentUser, IProjectRepository projects)
    {
        this.currentUser = currentUser;
        this.projects = projects;
    }

    public async Task<bool> CanAccessProjectAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        var user = await currentUser.GetCurrentUserAsync(cancellationToken);
        if (user is null)
            return false;
        if (user.Role == UserRole.Admin)
            return true;
        var memberships = await projects.GetByMemberAsync(user.Id, cancellationToken);
        return memberships.Any(p => p.Id == projectId);
    }

    public async Task<IReadOnlyCollection<Guid>?> GetAccessibleProjectIdsAsync(CancellationToken cancellationToken = default)
    {
        var user = await currentUser.GetCurrentUserAsync(cancellationToken);
        if (user is null)
            return [];
        if (user.Role == UserRole.Admin)
            return null;
        var memberships = await projects.GetByMemberAsync(user.Id, cancellationToken);
        return memberships.Select(p => p.Id).ToArray();
    }
}
