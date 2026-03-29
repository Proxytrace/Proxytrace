namespace Trsr.Domain.AgentCall;

public interface IAgentCall : IDomainEntity, IAgentCallData
{
    public delegate IAgentCall CreateNew(
        string model,
        string provider,
        string request,
        string? response,
        int? inputTokens,
        int? outputTokens,
        long durationMs,
        int httpStatus,
        string? finishReason,
        string? errorMessage);

    public delegate IAgentCall CreateExisting(IAgentCallData existing);
}
