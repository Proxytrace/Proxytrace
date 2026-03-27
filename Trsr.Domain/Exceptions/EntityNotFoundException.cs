namespace Trsr.Domain.Exceptions;

/// <summary>
/// An exception that is thrown when an entity is not found
/// </summary>
public sealed class EntityNotFoundException : Exception
{
    public EntityNotFoundException(Guid id, Type entityType) 
        : base($"The {entityType.Name} with id '{id}' was not found.")
    {
    }
}