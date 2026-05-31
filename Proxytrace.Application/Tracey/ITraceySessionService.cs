using Proxytrace.Domain.Project;

namespace Proxytrace.Application.Tracey;

/// <summary>
/// Mints a short-lived browser session for the Tracey assistant: a time-boxed Proxytrace API key
/// plus the coordinates the frontend AI runtime needs to reach the ingestion proxy.
/// </summary>
public interface ITraceySessionService
{
    /// <summary>
    /// Creates a Tracey session for the given project, minting a fresh API key that expires within
    /// one hour and resolving the project's Tracey agent + model endpoint.
    /// </summary>
    Task<TraceySessionResult> CreateSessionAsync(IProject project, CancellationToken cancellationToken = default);
}

/// <summary>
/// The result of <see cref="ITraceySessionService.CreateSessionAsync"/>: the short-lived bearer key
/// and the proxy base URL / model / agent the browser runtime should use.
/// </summary>
/// <param name="ApiKey">The short-lived Proxytrace key the browser sends as the bearer token.</param>
/// <param name="ProxyBaseUrl">The OpenAI-compatible base URL (already project-scoped, ending in <c>/v1</c>).</param>
/// <param name="Model">The model name to request against the proxy.</param>
/// <param name="AgentId">The id of the project's Tracey agent (for deep-links / attribution).</param>
public sealed record TraceySessionResult(
    string ApiKey,
    string ProxyBaseUrl,
    string Model,
    Guid AgentId);
