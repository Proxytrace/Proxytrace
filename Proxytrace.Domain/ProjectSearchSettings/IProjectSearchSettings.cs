using Proxytrace.Domain.Project;
using Proxytrace.Domain.Search;

namespace Proxytrace.Domain.ProjectSearchSettings;

/// <summary>
/// Per-project configuration for search indexing and querying.
/// </summary>
public interface IProjectSearchSettings : IDomainEntity, IProjectSpecific
{
    /// <summary>When false, search returns no results and indexing pauses.</summary>
    bool Enabled { get; }

    /// <summary>Entity kinds that participate in indexing/search.</summary>
    IReadOnlyCollection<SearchKind> IndexedKinds { get; }

    /// <summary>When true, write operations on indexed entities trigger an index update.</summary>
    bool AutoReindexOnChange { get; }

    /// <summary>Maximum length, in characters, of search-result snippets.</summary>
    int SnippetLength { get; }

    /// <summary>Factory delegate for creating new settings.</summary>
    public delegate IProjectSearchSettings CreateNew(
        IProject project,
        bool enabled,
        IReadOnlyCollection<SearchKind> indexedKinds,
        bool autoReindexOnChange,
        int snippetLength);

    /// <summary>Factory delegate for reconstituting existing settings from persistence.</summary>
    public delegate IProjectSearchSettings CreateExisting(
        IProject project,
        bool enabled,
        IReadOnlyCollection<SearchKind> indexedKinds,
        bool autoReindexOnChange,
        int snippetLength,
        IDomainEntityData existing);
}
