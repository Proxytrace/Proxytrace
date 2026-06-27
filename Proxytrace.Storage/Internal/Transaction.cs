using Proxytrace.Domain;

namespace Proxytrace.Storage.Internal;

/// <inheritdoc />
internal sealed class Transaction : ITransaction
{
    private readonly Func<StorageDbContext> contextFactory;
    private readonly AmbientDbContext ambient;

    public Transaction(Func<StorageDbContext> contextFactory, AmbientDbContext ambient)
    {
        this.contextFactory = contextFactory;
        this.ambient = ambient;
    }

    /// <inheritdoc />
    public bool IsActive => ambient.IsActive;

    /// <inheritdoc />
    public async Task<TResult> InvokeAsync<TResult>(Func<Task<TResult>> operation, CancellationToken cancellationToken = default)
    {
        // Nested call: already inside a logical transaction — run on the shared context so the
        // whole logical unit uses a single connection (never promotes to a 2-phase transaction).
        // Post-commit notifications accumulate on the outer flow and fire when it commits.
        if (ambient.IsActive)
        {
            return await operation();
        }

        StorageDbContext context = contextFactory();
        var efTransaction = await context.Database.BeginTransactionAsync(cancellationToken);
        ambient.Set(context, efTransaction);

        TResult result;
        IReadOnlyList<Action> postCommit;
        try
        {
            result = await operation();
            await efTransaction.CommitAsync(cancellationToken);
            // Capture deferred notifications only after the commit succeeds.
            postCommit = ambient.TakePostCommit();
        }
        catch
        {
            // Rollback discards the queued post-commit actions with the ambient state — they never fire.
            await efTransaction.RollbackAsync(CancellationToken.None);
            throw;
        }
        finally
        {
            ambient.Clear();
            await efTransaction.DisposeAsync();
            await context.DisposeAsync();
        }

        // Fire post-commit actions outside the transaction scope so a misbehaving consumer cannot
        // roll back an already-committed unit; the data is durable regardless of these side effects.
        foreach (Action action in postCommit)
        {
            action();
        }

        return result;
    }

    /// <inheritdoc />
    public Task InvokeAsync(Func<Task> operation, CancellationToken cancellationToken = default)
        => InvokeAsync<object?>(async () =>
        {
            await operation();
            return null;
        }, cancellationToken);
}
