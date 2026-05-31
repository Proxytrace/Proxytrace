using Proxytrace.Domain.Project;

namespace Proxytrace.Application.Tracey;

/// <summary>
/// Mints a short-lived browser session for the Tracey assistant: a time-boxed Proxytrace API key
/// plus the coordinates the frontend AI runtime needs to reach the ingestion proxy.
/// </summary>
public interface ITraceySessionService
{
    /// <summary>
    /// Resolves a Tracey session for the given project: ensures its Tracey agent exists and returns
    /// the model + agent the browser runtime should use. The browser talks to Tracey same-origin
    /// (via <c>/api/tracey/{projectId}/openai/v1</c> with its existing JWT), so no key is minted.
    /// </summary>
    Task<TraceySessionResult> CreateSessionAsync(IProject project, CancellationToken cancellationToken = default);
}

/// <summary>
/// The result of <see cref="ITraceySessionService.CreateSessionAsync"/>: the model and Tracey agent
/// the browser runtime should use.
/// </summary>
/// <param name="Model">The model name to request.</param>
/// <param name="AgentId">The id of the project's Tracey agent (for deep-links / attribution).</param>
public sealed record TraceySessionResult(
    string Model,
    Guid AgentId);
