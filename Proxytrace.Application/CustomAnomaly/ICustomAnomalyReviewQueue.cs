namespace Proxytrace.Application.CustomAnomaly;

/// <summary>
/// Queues freshly ingested agent calls for custom-anomaly review. Mirrors
/// <c>IAnomalyDetectionService</c>: <see cref="EnqueueAsync"/> is called from the ingestion
/// processor after a call persists, and a background loop drains the queue. Enqueueing is a cheap
/// in-process channel write — it must never fail ingestion.
/// </summary>
public interface ICustomAnomalyReviewQueue
{
    Task EnqueueAsync(Guid agentCallId, CancellationToken cancellationToken = default);
}
