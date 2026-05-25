using Proxytrace.Domain;

namespace Proxytrace.Storage.Internal.Entities;

internal interface IEntityAdapter<TDomainObject, TStored> 
    where TDomainObject : IDomainObject
{
    delegate TDomainObject Factory(TStored domainObject);
}