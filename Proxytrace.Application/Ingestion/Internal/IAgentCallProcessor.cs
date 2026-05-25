namespace Proxytrace.Application.Ingestion.Internal;

/// <summary>
/// Parses a captured proxy call and persists it as an <c>IAgentCall</c>, broadcasting the new
/// trace to live subscribers. This is the consumer-side work that used to run inline in the
/// in-process ingestor; it is now driven by <see cref="AgentCallIngestionWorker"/>.
/// </summary>
internal interface IAgentCallProcessor
{
    Task IngestAsync(IngestJob job, CancellationToken cancellationToken);
}
