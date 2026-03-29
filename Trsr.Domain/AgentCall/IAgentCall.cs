using System.Net;
using Trsr.Domain.Usage;

namespace Trsr.Domain.AgentCall;

public interface IAgentCall : IDomainEntity, IAgentCallData
{
    public delegate IAgentCall CreateNew(
        string model,
        string provider,
        string request,
        string? response,
        TokenUsage usage,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        string? finishReason,
        string? errorMessage);

    public delegate IAgentCall CreateExisting(IAgentCallData existing);
}
