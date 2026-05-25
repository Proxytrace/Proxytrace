using Proxytrace.Domain.Exceptions;

namespace Proxytrace.Domain;

/// <summary>
/// Extensions for <see cref="IRepository{TDomainEntity}"/>
/// </summary>
public static class RepositoryExtensions
{
    /// <summary>
    /// Gets a <typeparamref name="TDomainEntity"/> by its <paramref name="id"/>
    /// <exception cref="EntityNotFoundException">Thrown when the entity is not found</exception>
    /// </summary>
    public static async Task<TDomainEntity> GetAsync<TDomainEntity>(
        this IRepository<TDomainEntity> repository,
        Guid id,
        CancellationToken cancellationToken = default) where TDomainEntity : IDomainEntity
    {
        TDomainEntity? entity = await repository.FindAsync(id, cancellationToken);
        return entity ?? throw new EntityNotFoundException(id, typeof(TDomainEntity));
    }
}