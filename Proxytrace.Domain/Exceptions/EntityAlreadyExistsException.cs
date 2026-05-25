namespace Proxytrace.Domain.Exceptions;

/// <summary>
/// Exception thrown when an entity with the same ID already exists in the repository
/// </summary>
public sealed class EntityAlreadyExistsException : Exception
{
    public EntityAlreadyExistsException(Guid id, Type entityType) 
        : base($"Entity of type '{entityType.Name}' with id '{id}' already exists.")
    {
    }
}