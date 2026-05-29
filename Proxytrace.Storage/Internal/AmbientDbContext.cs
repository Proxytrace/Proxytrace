using Microsoft.EntityFrameworkCore.Storage;

namespace Proxytrace.Storage.Internal;

/// <summary>
/// Holds the StorageDbContext (and its EF transaction) that is active for the current
/// logical transaction. Lets nested repository calls share one context and therefore one
/// connection, so transactions never promote to a 2-phase (prepared) transaction.
/// </summary>
/// <remarks>
/// State is stored in an <see cref="AsyncLocal{T}"/> so it is scoped to the current async flow
/// rather than the DI scope. Singletons resolved from the root scope (e.g. the statistics
/// hosted services) share a single AmbientDbContext instance; backing the state with the DI
/// scope would let concurrent background workers clobber each other's context, causing
/// "A second operation was started on this context instance" and dispose races. Per-async-flow
/// isolation keeps each logical transaction's context private to the flow that opened it.
/// </remarks>
internal sealed class AmbientDbContext
{
    private readonly AsyncLocal<State?> current = new();

    public StorageDbContext? Context => current.Value?.Context;

    public IDbContextTransaction? Transaction => current.Value?.Transaction;

    public bool IsActive => current.Value is not null;

    public void Set(StorageDbContext context, IDbContextTransaction transaction)
        => current.Value = new State(context, transaction);

    public void Clear()
        => current.Value = null;

    /// <summary>
    /// Returns the active context or throws when no logical transaction is in progress.
    /// </summary>
    public StorageDbContext RequireContext()
        => Context ?? throw new InvalidOperationException(
            "No ambient transaction context is active. Repository writes must run inside ITransaction.InvokeAsync.");

    private sealed record State(StorageDbContext Context, IDbContextTransaction Transaction);
}
