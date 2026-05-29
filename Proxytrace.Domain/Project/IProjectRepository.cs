
namespace Proxytrace.Domain.Project;

/// <summary>
/// Repository for <see cref="IProject"/> entities with organization-scoped name lookup.
/// </summary>
public interface IProjectRepository : IRepository<IProject>
{
    /// <summary>
    /// Returns the project with the given <paramref name="name"/>
    /// or <see langword="null"/> if none exists.
    /// </summary>
    Task<IProject?> FindByNameAsync(string name, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the project whose name derives to the given URL <paramref name="slug"/>
    /// (see <c>SlugExtensions.ToSlug</c>), or <see langword="null"/> if none matches. Used by the
    /// proxy to attribute captured traffic to the project named in the request path.
    /// </summary>
    Task<IProject?> FindBySlugAsync(string slug, CancellationToken cancellationToken = default);
}
