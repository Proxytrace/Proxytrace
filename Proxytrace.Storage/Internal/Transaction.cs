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
    public async Task<TResult> InvokeAsync<TResult>(Func<Task<TResult>> operation)
    {
        // Nested call: already inside a logical transaction — run on the shared context so the
        // whole logical unit uses a single connection (never promotes to a 2-phase transaction).
        if (ambient.IsActive)
        {
            return await operation();
        }

        StorageDbContext context = contextFactory();
        var efTransaction = await context.Database.BeginTransactionAsync();
        ambient.Set(context, efTransaction);
        try
        {
            TResult result = await operation();
            await efTransaction.CommitAsync();
            return result;
        }
        catch
        {
            await efTransaction.RollbackAsync();
            throw;
        }
        finally
        {
            ambient.Clear();
            await efTransaction.DisposeAsync();
            await context.DisposeAsync();
        }
    }

    /// <inheritdoc />
    public Task InvokeAsync(Func<Task> operation)
        => InvokeAsync<object?>(async () =>
        {
            await operation();
            return null;
        });
}
