using System.Net;
using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Usage;

namespace Trsr.Domain.AgentCall;

/// <summary>
/// Records a single LLM call made by an agent, including request, response, token usage, and latency.
/// </summary>
public interface IAgentCall : IDomainEntity
{
    /// <summary>The agent that initiated this call, if associated.</summary>
    IAgent Agent { get; }
    
    IModelEndpoint Endpoint { get; }

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

    /// <summary>
    /// Groups this call with other calls from the same conversation thread.
    /// Set from the <c>X-Trsr-Session-Id</c> header or detected via message-history matching.
    /// </summary>
    Guid? ConversationId { get; }

    public delegate IAgentCall CreateNew(
        IAgent agent,
        IModelEndpoint endpoint,
        Conversation request,
        AssistantMessage response,
        TokenUsage usage,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        string? finishReason,
        string? errorMessage,
        Guid? conversationId = null);

    public delegate IAgentCall CreateExisting(
        IAgent agent,
        IModelEndpoint endpoint,
        Conversation request,
        AssistantMessage response,
        TokenUsage usage,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        string? finishReason,
        string? errorMessage,
        IDomainEntityData existing,
        Guid? conversationId = null);
}
