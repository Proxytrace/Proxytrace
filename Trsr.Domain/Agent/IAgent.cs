using Trsr.Domain.Message;
using Trsr.Domain.Tools;

namespace Trsr.Domain.Agent;

public interface IAgent : IDomainEntity, IAgentData
{
    public delegate IAgent CreateNew(SystemMessage systemMessage, IReadOnlyCollection<ToolSpecification> tools, Guid project);
    public delegate IAgent CreateExisting(IAgentData existing);
}