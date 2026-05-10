namespace Trsr.Storage.Internal.Entities.ProjectSearchSettings;

[StoredDomainEntity(typeof(Trsr.Domain.ProjectSearchSettings.IProjectSearchSettings))]
internal record ProjectSearchSettingsEntity : Entity
{
    /// <summary>
    /// <see cref="Trsr.Domain.ProjectSearchSettings.IProjectSearchSettings.Project"/>
    /// </summary>
    public required Guid Project { get; init; }

    /// <summary>
    /// <see cref="Trsr.Domain.ProjectSearchSettings.IProjectSearchSettings.Enabled"/>
    /// </summary>
    public required bool Enabled { get; init; }

    /// <summary>
    /// <see cref="Trsr.Domain.ProjectSearchSettings.IProjectSearchSettings.IndexedKinds"/>
    /// stored as a comma-separated list of <see cref="Trsr.Domain.Search.SearchKind"/> names.
    /// </summary>
    public required string IndexedKinds { get; init; }

    /// <summary>
    /// <see cref="Trsr.Domain.ProjectSearchSettings.IProjectSearchSettings.AutoReindexOnChange"/>
    /// </summary>
    public required bool AutoReindexOnChange { get; init; }

    /// <summary>
    /// <see cref="Trsr.Domain.ProjectSearchSettings.IProjectSearchSettings.SnippetLength"/>
    /// </summary>
    public required int SnippetLength { get; init; }
}
