namespace Trsr.Domain;

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
}