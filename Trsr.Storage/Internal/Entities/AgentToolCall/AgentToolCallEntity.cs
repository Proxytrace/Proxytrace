using Trsr.Domain.Message;

namespace Trsr.Storage.Internal.Entities.AgentToolCall;

[StoredDomainEntity(typeof(Trsr.Domain.AgentToolCall.IAgentToolCall))]
internal record AgentToolCallEntity : Entity
{
    public required Guid AgentCallId { get; init; }
    public required string ToolCallId { get; init; }
    public required ToolRequest Request { get; init; }
    public ToolResponse? Response { get; init; }
    public long? DurationMs { get; init; }
}
