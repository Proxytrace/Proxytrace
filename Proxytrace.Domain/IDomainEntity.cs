namespace Proxytrace.Domain;

/// <summary>
/// Marker interface combining <see cref="IDomainEntityData"/> and <see cref="IDomainObject"/>
/// for all persistent domain entities.
/// </summary>
public interface IDomainEntity : IDomainEntityData, IDomainObject;

public interface IDomainEntity<TSelf> : IDomainEntity where TSelf : IDomainEntity
{
    Task<TSelf> ReloadAsync(CancellationToken cancellationToken = default);
    Task<TSelf> AddAsync(CancellationToken cancellationToken = default);
    Task<TSelf> UpdateAsync(CancellationToken cancellationToken = default);
    Task<TSelf> UpsertAsync(CancellationToken cancellationToken = default);
    Task RemoveAsync(CancellationToken cancellationToken = default);
}