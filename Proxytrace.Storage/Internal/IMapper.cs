using Proxytrace.Domain;
using Proxytrace.Storage.Internal.Entities;

namespace Proxytrace.Storage.Internal;

internal interface IMapper<TDomainEntity, TStoredEntity>
    where TDomainEntity : IDomainEntity
    where TStoredEntity : class, IEntity
{
    public Task<TDomainEntity> Map(TStoredEntity storedEntity, CancellationToken cancellationToken = default);
    public Task<TStoredEntity> Map(TDomainEntity domainEntity, CancellationToken cancellationToken = default);
}