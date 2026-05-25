namespace Proxytrace.Domain.ProjectSearchSettings;

/// <summary>
/// Repository for <see cref="IProjectSearchSettings"/> with project-scoped lookup.
/// </summary>
public interface IProjectSearchSettingsRepository : IRepository<IProjectSearchSettings>
{
    /// <summary>
    /// Returns the settings row for the given project, or null if none has been persisted yet.
    /// </summary>
    Task<IProjectSearchSettings?> FindByProjectAsync(Guid projectId, CancellationToken cancellationToken = default);
}
