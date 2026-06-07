using Proxytrace.Application.ErrorLog.Internal;

namespace Proxytrace.Application.ErrorLog;

/// <summary>
/// Bounded in-memory hand-off between the capturing <c>ILogger</c> (producer) and the
/// <c>ErrorLogWriter</c> (consumer). Writes never block — they drop the oldest entry when full,
/// keeping the logging hot path fast and free of DB work.
/// </summary>
internal interface IErrorLogChannel
{
    /// <summary>
    /// Enqueues an entry, dropping the oldest if the buffer is full. Never blocks. Returns whether
    /// the entry was accepted.
    /// </summary>
    bool TryWrite(ErrorLogEntry entry);

    /// <summary>
    /// Asynchronously drains entries until cancellation.
    /// </summary>
    IAsyncEnumerable<ErrorLogEntry> ReadAllAsync(CancellationToken cancellationToken);
}
