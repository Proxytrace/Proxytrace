using Proxytrace.Domain.Exceptions;
using Proxytrace.Domain.Paging;

namespace Proxytrace.Domain;

/// <summary>
/// Repository for managing entities of type <typeparamref name="TDomainEntity"/>
/// </summary>
public interface IRepository<TDomainEntity>
    where TDomainEntity : IDomainEntity
{
    /// <summary>
    /// Finds a <typeparamref name="TDomainEntity"/> by its <paramref name="id"/>, or returns
    /// <see langword="null"/> when it does not exist. Use the <c>GetAsync</c> extension when a
    /// missing entity should throw <see cref="EntityNotFoundException"/> instead.
    /// </summary>
    Task<TDomainEntity?> FindAsync(
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
    /// Enumerates all entities of type <typeparamref name="TDomainEntity"/>
    /// </summary>
    IAsyncEnumerable<TDomainEntity> EnumerateAsync(CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Returns all entities of type <typeparamref name="TDomainEntity"/>
    /// </summary>
    Task<IReadOnlyList<TDomainEntity>> GetAllAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns a page of entities ordered by <c>CreatedAt</c> descending.
    /// </summary>
    Task<PagedResult<TDomainEntity>> GetPagedAsync(
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Returns all entities for the given primary keys. By default throws
    /// <c>EntitiesNotFoundException</c> if any key is missing. Pass <paramref name="ignoreMissing"/>
    /// to skip absent keys instead — used when resolving FK-less id lists stored as JSON (e.g. a
    /// suite's test cases) where a referenced child may have been hard-deleted; tolerating the gap
    /// keeps the parent loadable rather than letting one missing child make it unmappable.
    /// </summary>
    Task<IReadOnlyList<TDomainEntity>> GetManyAsync(IReadOnlyCollection<Guid> primaryKeys, CancellationToken cancellationToken = default, bool ignoreMissing = false);
    
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
    /// Adds all of the given <paramref name="entities"/> in a single batch.
    /// More efficient than repeated <see cref="AddAsync"/> calls: validates and persists
    /// the whole batch in one transaction with a single save and no per-entity round trips.
    /// <exception cref="EntityAlreadyExistsException">Thrown when any entity already exists</exception>
    /// </summary>
    Task AddRangeAsync(
        IReadOnlyCollection<TDomainEntity> entities,
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
    
    /// <summary>
    /// Removes all entities of type <typeparamref name="TDomainEntity"/> from the repository
    /// </summary>
    Task RemoveAllAsync(CancellationToken cancellationToken = default);
}