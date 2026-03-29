using Trsr.Domain.AgentCall;
using Trsr.Domain.Usage;

namespace Trsr.Storage.Internal.Entities.AgentCall;

[StoredDomainEntity(typeof(IAgentCall))]
internal record AgentCallEntity : Entity
{
    public required string Model { get; init; }
    public required string Provider { get; init; }
    public required string RequestJson { get; init; }
    public required string ResponseJson { get; init; }
    public TokenUsage Usage => new((ulong)InputTokens, (ulong)OutputTokens);
    public TimeSpan Duration => TimeSpan.FromMilliseconds(DurationMs);
    public int InputTokens { get; init; }
    public int OutputTokens { get; init; }
    public required long DurationMs { get; init; }
    public required int HttpStatus { get; init; }
    public string? FinishReason { get; init; }
    public string? ErrorMessage { get; init; }
}
