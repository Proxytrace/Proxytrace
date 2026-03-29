using System.Net;
using Trsr.Domain.Message;
using Trsr.Domain.Usage;

namespace Trsr.Domain.AgentCall;

public interface IAgentCall : IDomainEntity, IAgentCallData
{
    public delegate IAgentCall CreateNew(
        string model,
        string provider,
        Conversation request,
        AssistantMessage response,
        TokenUsage usage,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        string? finishReason,
        string? errorMessage);

    public delegate IAgentCall CreateExisting(IAgentCallData existing);
}
