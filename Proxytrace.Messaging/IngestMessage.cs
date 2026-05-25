namespace Proxytrace.Messaging;

/// <summary>
/// Wire format for a captured proxy call handed from the ingestion proxy service to the
/// main app's ingestion worker. Holds only primitive identifiers and the raw bodies — the
/// consumer re-hydrates the <c>IModelProvider</c>/<c>IProject</c> from the shared database by id.
/// </summary>
public sealed record IngestMessage(
    Guid ProviderId,
    Guid ProjectId,
    string RequestBody,
    string? ResponseBody,
    long DurationMs,
    int HttpStatus,
    string? SessionId);
