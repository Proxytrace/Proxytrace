using System.Net;
using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Domain.Usage;

namespace Trsr.Domain.AgentCall;

/// <summary>
/// Records a single LLM call made by an agent, including request, response, token usage, and latency.
/// </summary>
public interface IAgentCall : IDomainEntity
{
    /// <summary>The agent that initiated this call, if associated.</summary>
    IAgent? Agent { get; }

    /// <summary>The model identifier used for this call (e.g. <c>claude-sonnet-4-6</c>).</summary>
    string Model { get; }

    /// <summary>The provider that served the model (e.g. <c>anthropic</c>).</summary>
    string Provider { get; }

    /// <summary>The conversation sent as the request.</summary>
    Conversation Request { get; }

    /// <summary>The assistant message returned as the response.</summary>
    AssistantMessage Response { get; }

    /// <summary>Token consumption metrics for this call.</summary>
    TokenUsage Usage { get; }

    /// <summary>Wall-clock time elapsed for the call.</summary>
    TimeSpan Duration { get; }

    /// <summary>HTTP status code returned by the provider.</summary>
    HttpStatusCode HttpStatus { get; }

    /// <summary>The model's stop reason, if provided (e.g. <c>end_turn</c>).</summary>
    string? FinishReason { get; }

    /// <summary>Error message if the call failed; otherwise <see langword="null"/>.</summary>
    string? ErrorMessage { get; }

    public delegate IAgentCall CreateNew(
        string model,
        string provider,
        Conversation request,
        AssistantMessage response,
        TokenUsage usage,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        string? finishReason,
        string? errorMessage,
        IAgent? agent = null);

    public delegate IAgentCall CreateExisting(
        string model,
        string provider,
        Conversation request,
        AssistantMessage response,
        TokenUsage usage,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        string? finishReason,
        string? errorMessage,
        IDomainEntityData existing,
        IAgent? agent = null);
}
