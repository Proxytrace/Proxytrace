using System.Net;
using Trsr.Domain.Message;
using Trsr.Domain.Usage;

namespace Trsr.Domain.AgentCall;

public interface IAgentCallData : IDomainEntityData
{
    Guid AgentId { get; }
    string Model { get; }
    string Provider { get; }
    Conversation Request { get; }
    AssistantMessage Response { get; }
    TokenUsage Usage { get; }
    TimeSpan Duration { get; }
    HttpStatusCode HttpStatus { get; }
    string? FinishReason { get; }
    string? ErrorMessage { get; }
}
