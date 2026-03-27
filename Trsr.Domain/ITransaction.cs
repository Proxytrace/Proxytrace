namespace Trsr.Domain;

/// <summary>
/// Service for invoking operations in a transaction
/// </summary>
public interface ITransaction
{
    /// <summary>
    /// Invokes the <paramref name="operation"/> in a transaction
    /// Automatically commits if the operation completes successfully
    /// Rolls back if the operation throws an exception
    /// </summary>
    Task<TResult> InvokeAsync<TResult>(Func<Task<TResult>> operation);
    
    /// <summary>
    /// Invokes the <paramref name="operation"/> in a transaction
    /// Automatically commits if the operation completes successfully
    /// Rolls back if the operation throws an exception
    /// </summary>
    Task InvokeAsync(Func<Task> operation);
}