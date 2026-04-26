using Trsr.Domain.Message;

namespace Trsr.Storage.Internal.Entities.AgentCall;

[StoredDomainEntity(typeof(Trsr.Domain.AgentCall.IAgentCall))]
internal record AgentCallEntity : Entity
{
    public required Guid AgentId { get; init; }
    public required Guid EndpointId { get; init; }
    public required Conversation Request { get; init; }
    public required AssistantMessage Response { get; init; }
    public int InputTokens { get; init; }
    public int OutputTokens { get; init; }
    public required long DurationMs { get; init; }
    public required int HttpStatus { get; init; }
    public string? FinishReason { get; init; }
    public string? ErrorMessage { get; init; }
}
