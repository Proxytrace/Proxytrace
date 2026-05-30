namespace Proxytrace.Api.Dto.AgentCalls;

/// <summary>
/// Test-only request to seed an agent call (trace) directly, bypassing the ingestion pipeline.
/// Used by the e2e suite to create traces without making real LLM calls.
/// </summary>
public record SeedAgentCallRequest(
    Guid AgentId,
    string Model,
    string UserContent,
    string AssistantContent,
    string? SystemContent,
    int InputTokens,
    int OutputTokens,
    int DurationMs);
