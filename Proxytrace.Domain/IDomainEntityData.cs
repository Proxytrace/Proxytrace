namespace Proxytrace.Domain;

/// <summary>
/// Data common to all domain entities
/// </summary>
public interface IDomainEntityData
{
    /// <summary>
    /// The unique identifier of the entity
    /// </summary>
    Guid Id { get; }
    
    /// <summary>
    /// The timestamp when the entity was created
    /// </summary>
    DateTimeOffset CreatedAt { get; }
    
    /// <summary>
    /// The timestamp when the entity was last updated
    /// </summary>
    DateTimeOffset UpdatedAt { get; }

    /// <summary>
    /// Whether the entity has been soft-deleted (archived). Defaults to <c>false</c>; only entities
    /// that opt in to the archive pattern (their storage entity implements
    /// <c>IArchivableEntity</c> and their domain interface <see cref="IArchivable"/>) ever set it.
    /// Archived entities are hidden from list/picker queries but stay resolvable by id so historical
    /// references continue to load.
    /// </summary>
    bool IsArchived => false;
}