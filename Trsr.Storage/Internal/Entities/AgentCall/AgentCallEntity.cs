using System.Net;
using Trsr.Common.Serialization;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Message;
using Trsr.Domain.Usage;

namespace Trsr.Storage.Internal.Entities.AgentCall;

[StoredDomainEntity(typeof(IAgentCall))]
internal record AgentCallEntity : Entity, IAgentCallData
{
    public required Guid AgentId { get; init; }
    public required string Model { get; init; }
    public required string Provider { get; init; }
    public required Conversation Request  { get; init; }
    public required AssistantMessage Response  { get; init; }
    public TokenUsage Usage => new((ulong)InputTokens, (ulong)OutputTokens);
    public int InputTokens { get; init; }
    public int OutputTokens { get; init; }
    public required long DurationMs { get; init; }
    public required int HttpStatus { get; init; }
    public string? FinishReason { get; init; }
    public string? ErrorMessage { get; init; }
    public TimeSpan Duration => TimeSpan.FromMilliseconds(DurationMs);
    HttpStatusCode IAgentCallData.HttpStatus => (HttpStatusCode)HttpStatus;

}
