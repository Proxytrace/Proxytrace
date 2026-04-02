namespace Trsr.Domain;

/// <summary>
/// Marker interface combining <see cref="IDomainEntityData"/> and <see cref="IDomainObject"/>
/// for all persistent domain entities.
/// </summary>
public interface IDomainEntity : IDomainEntityData, IDomainObject;