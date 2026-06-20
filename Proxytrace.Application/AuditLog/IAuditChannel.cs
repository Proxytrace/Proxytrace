using System.Diagnostics.CodeAnalysis;
using Proxytrace.Application.AuditLog.Internal;

namespace Proxytrace.Application.AuditLog;

/// <summary>
/// Unbounded in-memory hand-off between the capturing <c>ILogger</c> (producer) and the
/// <c>AuditWriter</c> (consumer). Unlike the error-log channel, writes are never dropped (<see
/// cref="TryWrite"/> always succeeds) — audit events are low-frequency and should all persist. On
/// shutdown the writer makes a best-effort drain of the backlog (see <c>AuditWriter</c>); the writer
/// is never completed, so this is not an absolute guarantee against loss of an entry enqueued during
/// shutdown.
/// </summary>
internal interface IAuditChannel
{
    /// <summary>Enqueues an entry. Never blocks and never drops; always returns <see langword="true"/>.</summary>
    bool TryWrite(AuditCapture entry);

    /// <summary>Asynchronously drains entries until cancellation.</summary>
    IAsyncEnumerable<AuditCapture> ReadAllAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Synchronously dequeues a buffered entry if one is immediately available. Used to drain the
    /// remaining backlog on shutdown (once <see cref="ReadAllAsync"/>'s token is cancelled) so queued
    /// audits still persist.
    /// </summary>
    bool TryRead([MaybeNullWhen(false)] out AuditCapture entry);
}
