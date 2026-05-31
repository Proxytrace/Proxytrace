namespace Proxytrace.Api.Dto.Tracey;

/// <summary>
/// The browser session payload for the Tracey assistant: the model + Tracey agent the frontend AI
/// runtime uses. The runtime calls Tracey same-origin with the app JWT, so there is no proxy key.
/// </summary>
public sealed record TraceySessionDto(
    string Model,
    Guid AgentId);
