using Trsr.Domain;
using Trsr.Storage.Internal.Entities;

namespace Trsr.Storage.Internal;

internal class Mapper<TDomainEntity, TStoredEntity> : IMapper<TDomainEntity, TStoredEntity>
    where TDomainEntity : IDomainEntity
    where TStoredEntity : class, IEntity
{
    private readonly Func<TDomainEntity, TStoredEntity> toStoredEntity;
    private readonly Func<TStoredEntity, TDomainEntity> toDomainEntity;

    public Mapper(
        Func<TDomainEntity, TStoredEntity> toStoredEntity, 
        Func<TStoredEntity, TDomainEntity> toDomainEntity)
    {
        this.toStoredEntity = toStoredEntity;
        this.toDomainEntity = toDomainEntity;
    }
    
    public TDomainEntity Map(TStoredEntity storedEntity)
        => toDomainEntity(storedEntity);

    public TStoredEntity Map(TDomainEntity domainEntity)
        => toStoredEntity(domainEntity);
}