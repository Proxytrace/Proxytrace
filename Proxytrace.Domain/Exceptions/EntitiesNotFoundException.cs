namespace Proxytrace.Domain.Exceptions;

/// <summary>
/// An exception that is thrown when entities are not found
/// </summary>
public sealed class EntitiesNotFoundException : Exception
{
    public EntitiesNotFoundException(IEnumerable<Guid> ids, Type entityType) 
        : base($"One or more {entityType.Name} with ids '{string.Join(", ", ids)}' were not found.")
    {
    }
}