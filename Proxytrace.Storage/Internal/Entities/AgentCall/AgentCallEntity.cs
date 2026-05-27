using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.Message;
using Proxytrace.Storage.Internal.Entities.Inference;

namespace Proxytrace.Storage.Internal.Entities.AgentCall;

[StoredDomainEntity(typeof(IAgentCall))]
internal record AgentCallEntity : Entity
{
    public required Guid AgentVersionId { get; init; }
    public required Guid EndpointId { get; init; }
    public required Conversation Request { get; init; }
    public required AssistantMessage? Response { get; init; }
    public required ulong? InputTokens { get; init; }
    public required ulong? OutputTokens { get; init; }
    public required double? LatencyMs { get; init; }
    public required int HttpStatus { get; init; }
    public required string? FinishReason { get; init; }
    public required string? ErrorMessage { get; init; }
    public required ModelParametersData ModelParameters { get; init; }
    public required Guid? ConversationId { get; init; }
}
