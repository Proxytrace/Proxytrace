using Trsr.Domain.Message;
using Trsr.Domain.Tools;

namespace Trsr.Domain.Agent;

public interface IAgent : IDomainEntity, IAgentData
{
    public delegate IAgent CreateNew(SystemMessage systemMessage, Guid project, IReadOnlyCollection<ToolSpecification> tools);
    public delegate IAgent CreateExisting(IAgentData existing);
}