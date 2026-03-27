using Trsr.Domain.Exceptions;

namespace Trsr.Domain;

/// <summary>
/// Repository for managing entities of type <typeparamref name="TDomainEntity"/>
/// </summary>
public interface IRepository<TDomainEntity>
    where TDomainEntity : IDomainEntity
{
    /// <summary>
    /// Gets a <typeparamref name="TDomainEntity"/> by its <paramref name="id"/>
    /// <exception cref="EntityNotFoundException">Thrown when the entity is not found</exception>
    /// </summary>
    Task<TDomainEntity> GetAsync(    
        Guid id,
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Whether an entity with the given <paramref name="id"/> exists in the repository
    /// </summary>
    Task<bool> ContainsAsync(
        Guid id,
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Gets the total count of entities of type <typeparamref name="TDomainEntity"/>
    /// </summary>
    Task<int> CountAsync(CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Returns all entities of type <typeparamref name="TDomainEntity"/>
    /// </summary>
    Task<IReadOnlyList<TDomainEntity>> GetAllAsync(CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Returns the first entity of type <typeparamref name="TDomainEntity"/>, or null if none exist
    /// </summary>
    Task<TDomainEntity?> FindFirstAsync(CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Adds the given <paramref name="entity"/>
    /// <exception cref="EntityAlreadyExistsException">Thrown when the entity already exists</exception>
    /// </summary>
    Task<TDomainEntity> AddAsync(
        TDomainEntity entity, 
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Updates the given <paramref name="entity"/>
    /// <exception cref="EntityNotFoundException">Thrown when the entity does not exist</exception>
    /// </summary>
    Task<TDomainEntity> UpdateAsync(
        TDomainEntity entity, 
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Updates the given <paramref name="entity"/> if it exists, otherwise adds it.
    /// </summary>
    Task<TDomainEntity> UpsertAsync(
        TDomainEntity entity, 
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Removes the entity with the given <paramref name="id"/>
    /// Returns true if the entity was removed, false if it did not exist
    /// </summary>
    Task<bool> RemoveAsync(
        Guid id, 
        CancellationToken cancellationToken = default);
}