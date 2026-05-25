using Proxytrace.Domain.ProjectSearchSettings;

namespace Proxytrace.Storage.Internal.Entities.ProjectSearchSettings;

[StoredDomainEntity(typeof(IProjectSearchSettings))]
internal record ProjectSearchSettingsEntity : Entity
{
    /// <summary>
    /// <see cref="Proxytrace.Domain.ProjectSearchSettings.IProjectSearchSettings.Project"/>
    /// </summary>
    public required Guid Project { get; init; }

    /// <summary>
    /// <see cref="Proxytrace.Domain.ProjectSearchSettings.IProjectSearchSettings.Enabled"/>
    /// </summary>
    public required bool Enabled { get; init; }

    /// <summary>
    /// <see cref="Proxytrace.Domain.ProjectSearchSettings.IProjectSearchSettings.IndexedKinds"/>
    /// stored as a comma-separated list of <see cref="Proxytrace.Domain.Search.SearchKind"/> names.
    /// </summary>
    public required string IndexedKinds { get; init; }

    /// <summary>
    /// <see cref="Proxytrace.Domain.ProjectSearchSettings.IProjectSearchSettings.AutoReindexOnChange"/>
    /// </summary>
    public required bool AutoReindexOnChange { get; init; }

    /// <summary>
    /// <see cref="Proxytrace.Domain.ProjectSearchSettings.IProjectSearchSettings.SnippetLength"/>
    /// </summary>
    public required int SnippetLength { get; init; }
}
