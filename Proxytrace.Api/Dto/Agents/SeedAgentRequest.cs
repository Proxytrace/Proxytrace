namespace Proxytrace.Api.Dto.Agents;

/// <summary>
/// Test-only request to seed an agent directly, bypassing the ingestion pipeline.
/// Used by the e2e suite to create agents without making real LLM calls.
/// </summary>
public record SeedAgentRequest(
    string Name,
    string SystemMessage,
    Guid EndpointId,
    Guid? ProjectId);
