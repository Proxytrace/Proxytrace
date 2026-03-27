using Trsr.Domain;
using Trsr.Storage.Internal.Entities;

namespace Trsr.Storage.Internal;

internal interface IMapper<TDomainEntity, TStoredEntity>
    where TDomainEntity : IDomainEntity
    where TStoredEntity : class, IEntity
{
    public TDomainEntity Map(TStoredEntity storedEntity);
    public TStoredEntity Map(TDomainEntity domainEntity);
}