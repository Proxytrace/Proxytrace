namespace Trsr.Storage.Internal.Entities;

/// <summary>
/// Extensions for <see cref="IEntity"/>
/// </summary>
internal static class EntityExtensions
{
    /// <summary>
    /// Gets the domain entity type for a stored entity type
    /// </summary>
    public static Type GetDomainEntityType(this Type storedEntityType) 
        => storedEntityType
            .GetCustomAttributes(typeof(StoredDomainEntityAttribute), false)
            .OfType<StoredDomainEntityAttribute>()
            .FirstOrDefault()?.DomainEntityType 
           ?? throw new InvalidOperationException(
            $"Entity type {storedEntityType.Name} does not have a StoredDomainEntityAttribute");
}