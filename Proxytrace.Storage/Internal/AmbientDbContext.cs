using Microsoft.EntityFrameworkCore.Storage;

namespace Proxytrace.Storage.Internal;

/// <summary>
/// Holds the StorageDbContext (and its EF transaction) that is active for the current
/// logical transaction within a DI scope. Lets nested repository calls share one context and
/// therefore one connection, so transactions never promote to a 2-phase (prepared) transaction.
/// </summary>
internal sealed class AmbientDbContext
{
    public StorageDbContext? Context { get; private set; }

    public IDbContextTransaction? Transaction { get; private set; }

    public bool IsActive => Context is not null;

    public void Set(StorageDbContext context, IDbContextTransaction transaction)
    {
        Context = context;
        Transaction = transaction;
    }

    public void Clear()
    {
        Context = null;
        Transaction = null;
    }

    /// <summary>
    /// Returns the active context or throws when no logical transaction is in progress.
    /// </summary>
    public StorageDbContext RequireContext()
        => Context ?? throw new InvalidOperationException(
            "No ambient transaction context is active. Repository writes must run inside ITransaction.InvokeAsync.");
}
