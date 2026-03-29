namespace Trsr.Domain.AgentCall;

public interface IAgentCallData : IDomainEntityData
{
    /// <summary>The model name, e.g. "gpt-4o"</summary>
    string Model { get; }
    /// <summary>The upstream provider, e.g. "openai"</summary>
    string Provider { get; }
    /// <summary>Full JSON request body sent to the upstream</summary>
    string Request { get; }
    /// <summary>Full JSON response body received from the upstream; null for streaming calls or errors</summary>
    string? Response { get; }
    int? InputTokens { get; }
    int? OutputTokens { get; }
    /// <summary>Wall-clock latency in milliseconds</summary>
    long DurationMs { get; }
    /// <summary>HTTP status code returned by the upstream</summary>
    int HttpStatus { get; }
    /// <summary>"stop" | "length" | "tool_calls" | null</summary>
    string? FinishReason { get; }
    /// <summary>Non-null when the upstream returned a non-2xx status</summary>
    string? ErrorMessage { get; }
}
