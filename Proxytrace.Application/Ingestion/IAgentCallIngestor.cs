using System.Net;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Project;

namespace Proxytrace.Application.Ingestion;

public interface IAgentCallIngestor
{
    /// <summary>
    /// Parses model/tokens/finish_reason from the raw JSON bodies and persists an <c>IAgentCall</c>.
    /// Never throws — failures are logged and swallowed so the proxy never breaks the client.
    /// <paramref name="sessionId"/> is the raw value of the <c>X-Proxytrace-Session-Id</c> request header;
    /// when present it is used to group calls from the same conversation thread.
    /// </summary>
    Task IngestInBackgroundAsync(
        IModelProvider provider,
        IProject project,
        string requestBody,
        string? responseBody,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        string? sessionId = null,
        CancellationToken cancellationToken = default);
}
