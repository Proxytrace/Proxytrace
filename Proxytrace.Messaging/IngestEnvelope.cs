namespace Proxytrace.Messaging;

/// <summary>
/// A consumed <see cref="IngestMessage"/> together with the transport-level identifier needed
/// to acknowledge it once processing succeeds.
/// </summary>
public sealed record IngestEnvelope(string MessageId, IngestMessage Message);
