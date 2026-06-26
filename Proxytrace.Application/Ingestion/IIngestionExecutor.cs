using Proxytrace.Messaging;

namespace Proxytrace.Application.Ingestion;

/// <summary>
/// Persists a captured call <b>in-process</b>: enforces the monthly trace quota, re-hydrates the
/// referenced provider/project, and hands the work to the ingestion processor.
/// <para>
/// This is the exact work the <see cref="IIngestionStream"/> consumer does per envelope, exposed
/// directly so a <b>same-process</b> producer can ingest without round-tripping through the Redis
/// Streams transport. That transport exists only to bridge the <b>out-of-process</b> ingestion proxy
/// to the app; an in-process producer such as the Tracey chat passthrough has no reason to depend on
/// it (and silently loses captures when it is unavailable). The cross-process proxy keeps publishing
/// to the stream; only same-process producers use this.
/// </para>
/// </summary>
public interface IIngestionExecutor
{
    /// <summary>
    /// Ingests a single captured call synchronously in the caller's context. Throws the same
    /// exceptions the stream consumer would surface (e.g. a missing provider/project, transient
    /// storage errors); callers off the request hot path should guard accordingly.
    /// </summary>
    Task IngestAsync(IngestMessage message, CancellationToken cancellationToken = default);
}
