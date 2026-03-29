namespace Trsr.Api.Services;

public interface IAgentCallIngestionService
{
    /// <summary>
    /// Parses model/tokens/finish_reason from the raw JSON bodies and persists an <c>IAgentCall</c>.
    /// Never throws — failures are logged and swallowed so the proxy never breaks the client.
    /// </summary>
    Task IngestAsync(
        string provider,
        string requestBody,
        string? responseBody,
        long durationMs,
        int httpStatus,
        CancellationToken cancellationToken);
}
