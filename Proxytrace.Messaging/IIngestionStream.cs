namespace Proxytrace.Messaging;

/// <summary>
/// Transport for captured proxy calls between the ingestion proxy (producer) and the main
/// app's ingestion worker (consumer). Backed in production by Redis Streams; backed in tests
/// and single-process runs by an in-memory channel.
/// </summary>
public interface IIngestionStream
{
    /// <summary>
    /// Publishes a captured call. Producers call this fire-and-forget on the proxy hot path;
    /// it must be cheap and must never be relied upon to surface processing errors.
    /// </summary>
    Task PublishAsync(IngestMessage message, CancellationToken cancellationToken = default);

    /// <summary>
    /// Long-running consumer stream. Yields envelopes until <paramref name="cancellationToken"/>
    /// is cancelled. Each yielded envelope must be acknowledged via <see cref="AckAsync"/> once
    /// processing succeeds; unacknowledged envelopes are redelivered.
    /// </summary>
    IAsyncEnumerable<IngestEnvelope> ConsumeAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Acknowledges successful processing of a previously consumed envelope.
    /// </summary>
    Task AckAsync(string messageId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Best-effort backlog depth: how many published entries are waiting to be processed (Redis
    /// consumer-group lag, or the in-process channel's queued count). Surfaced as dashboard live
    /// telemetry so a lagging consumer is visible before the stream's trim cap silently drops
    /// unprocessed entries. Returns 0 when the depth cannot be determined.
    /// </summary>
    Task<long> GetQueueDepthAsync(CancellationToken cancellationToken = default);
}
