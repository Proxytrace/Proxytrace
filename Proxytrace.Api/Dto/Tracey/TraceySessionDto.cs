namespace Proxytrace.Api.Dto.Tracey;

/// <summary>
/// The browser session payload for the Tracey assistant: a short-lived proxy key and the
/// coordinates the frontend AI runtime uses to reach the ingestion proxy.
/// </summary>
public sealed record TraceySessionDto(
    string ApiKey,
    string ProxyBaseUrl,
    string Model,
    Guid AgentId);
