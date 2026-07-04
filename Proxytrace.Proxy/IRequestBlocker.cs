namespace Proxytrace.Proxy;

/// <summary>
/// The blocking detector that fired for a request: which detector, and which trigger pattern
/// matched. The matched excerpt is deliberately not carried — it may be the very secret the
/// detector exists to stop, so it must appear in no response, log, or ingest message.
/// </summary>
public sealed record BlockedRequestMatch(Guid DetectorId, string DetectorName, string TriggerPattern);

/// <summary>
/// The proxy's real-time enforcement seam: evaluates the project's blocking anomaly detectors
/// against a request body before it is forwarded upstream. Returns the first match (detector
/// order) or <see langword="null"/> when the request may proceed. Fail-open by design — a
/// detector-evaluation problem must never take LLM traffic down; the post-ingestion review
/// pipeline still flags anything that slips through.
/// </summary>
public interface IRequestBlocker
{
    Task<BlockedRequestMatch?> EvaluateAsync(
        Guid projectId,
        string? agentName,
        string requestBody,
        CancellationToken cancellationToken);
}
