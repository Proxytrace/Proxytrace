using System.Net;
using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Domain.Usage;

namespace Trsr.Domain.AgentCall;

public interface IAgentCall : IDomainEntity
{
    IAgent? Agent { get; }
    string Model { get; }
    string Provider { get; }
    Conversation Request { get; }
    AssistantMessage Response { get; }
    TokenUsage Usage { get; }
    TimeSpan Duration { get; }
    HttpStatusCode HttpStatus { get; }
    string? FinishReason { get; }
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
