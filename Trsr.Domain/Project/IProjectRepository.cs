
namespace Trsr.Domain.Project;

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
}
