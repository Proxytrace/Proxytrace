using Trsr.Domain;
using Trsr.Storage.Internal.Entities;

namespace Trsr.Storage.Internal;

internal interface IMapper<TDomainEntity, TStoredEntity>
    where TDomainEntity : IDomainEntity
    where TStoredEntity : class, IEntity
{
    public Task<TDomainEntity> Map(TStoredEntity storedEntity, CancellationToken cancellationToken = default);
    public Task<TStoredEntity> Map(TDomainEntity domainEntity, CancellationToken cancellationToken = default);
}