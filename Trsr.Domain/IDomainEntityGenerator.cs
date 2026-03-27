namespace Trsr.Domain;

/// <summary>
/// Generator for test data of <see cref="IDomainEntity"/>s
/// </summary>
public interface IDomainEntityGenerator<TDomainEntity> : IDomainObjectGenerator<TDomainEntity>
    where TDomainEntity : IDomainEntity
{
    /// <summary>
    /// Gets any existing or creates a new instance of <typeparamref name="TDomainEntity"/>
    /// </summary>
    Task<TDomainEntity> GetOrCreateAsync(CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Generates a new instance of <typeparamref name="TDomainEntity"/> without adding it to the repository
    /// </summary>
    internal Task<TDomainEntity> GenerateAsync(CancellationToken cancellationToken = default);
}