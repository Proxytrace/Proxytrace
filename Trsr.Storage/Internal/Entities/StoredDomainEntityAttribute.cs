namespace Trsr.Storage.Internal.Entities;

/// <summary>
/// Associates a storage entity with a domain entity
/// </summary>
internal class StoredDomainEntityAttribute : Attribute
{
    /// <summary>
    /// The domain entity type that this storage entity maps to
    /// </summary>
    public Type DomainEntityType { get; }

    public StoredDomainEntityAttribute(Type domainEntityType)
    {
        DomainEntityType = domainEntityType;
    }
}