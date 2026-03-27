namespace Trsr.Domain.Exceptions;

/// <summary>
/// Thrown when an optimistic concurrency conflict occurs
/// </summary>
public sealed class OptimisticConcurrencyException : Exception
{
    public OptimisticConcurrencyException(Guid id, Type entityType) 
        : base($"The {entityType.Name} with id '{id}' was modified by another process.")
    {
    }
}