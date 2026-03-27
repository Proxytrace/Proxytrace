using System.ComponentModel.DataAnnotations;
using Trsr.Domain;

namespace Trsr.Storage.Internal.Entities;

/// <summary>
/// Interface for all entities
/// </summary>
internal interface IEntity : IValidatableObject
{
    /// <summary>
    /// The unique identifier of the entity
    /// <see cref="IDomainEntity.Id"/>
    /// </summary>
    Guid Id { get; }
    
    /// <summary>
    /// The timestamp when the entity was created
    /// <see cref="IDomainEntity.CreatedAt"/>
    /// </summary>
    DateTimeOffset CreatedAt { get; }
    
    /// <summary>
    /// The timestamp when the entity was last updated
    /// <see cref="IDomainEntity.UpdatedAt"/>
    /// </summary>
    DateTimeOffset UpdatedAt { get; }
}