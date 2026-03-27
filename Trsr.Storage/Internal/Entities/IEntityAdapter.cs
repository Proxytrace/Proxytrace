using Trsr.Domain;

namespace Trsr.Storage.Internal.Entities;

internal interface IEntityAdapter<TDomainObject, TStored> 
    where TDomainObject : IDomainObject
{
    delegate TDomainObject Factory(TStored domainObject);
}