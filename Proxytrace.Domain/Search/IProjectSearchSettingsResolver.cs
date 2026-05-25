using Proxytrace.Domain.ProjectSearchSettings;

namespace Proxytrace.Domain.Search;

/// <summary>
/// Resolves per-project search settings, returning a defaults instance when no row has been persisted.
/// </summary>
public interface IProjectSearchSettingsResolver
{
    /// <summary>
    /// Returns persisted settings for the project, or a transient defaults object if none exist yet.
    /// </summary>
    Task<IProjectSearchSettings> GetOrDefaultsAsync(Guid projectId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Persists the given settings, replacing any existing row for the same project.
    /// </summary>
    Task<IProjectSearchSettings> UpsertAsync(IProjectSearchSettings settings, CancellationToken cancellationToken = default);
}
