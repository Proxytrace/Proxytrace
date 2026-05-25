namespace Proxytrace.Domain;

/// <summary>
/// Service for test data generation of domain objects
/// </summary>
public interface IDomainObjectGenerator<TDomainObject>
    where TDomainObject : IDomainObject
{
    /// <summary>
    /// Generates a new instance of <typeparamref name="TDomainObject"/> and adds it to the repository
    /// </summary>
    Task<TDomainObject> CreateAsync(CancellationToken cancellationToken = default);
}