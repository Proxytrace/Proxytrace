using System.Transactions;
using Proxytrace.Domain;

namespace Proxytrace.Storage.Internal;

/// <inheritdoc />
internal class Transaction : ITransaction
{
    /// <inheritdoc />
    public async Task<TResult> InvokeAsync<TResult>(Func<Task<TResult>> operation)
    {
        using TransactionScope scope = new(
            scopeOption: TransactionScopeOption.Required,
            transactionOptions: new TransactionOptions { IsolationLevel = IsolationLevel.ReadCommitted },
            asyncFlowOption: TransactionScopeAsyncFlowOption.Enabled);
        
        var result = await operation();
        scope.Complete();
        return result;
    }
    
    /// <inheritdoc />
    public Task InvokeAsync(Func<Task> operation) 
        => InvokeAsync<object?>(async () =>
        {
            await operation();
            return null;
        });
}