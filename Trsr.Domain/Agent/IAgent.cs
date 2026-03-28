using Trsr.Domain.Message;

namespace Trsr.Domain.Agent;

public interface IAgent : IDomainEntity, IAgentData
{
    public delegate IAgent CreateNew(SystemMessage systemMessage, Guid project);
    public delegate IAgent CreateExisting(IAgentData existing);
}