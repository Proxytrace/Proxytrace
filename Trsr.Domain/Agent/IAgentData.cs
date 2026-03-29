using Trsr.Domain.Message;
using Trsr.Domain.Tools;

namespace Trsr.Domain.Agent;

public interface IAgentData : IDomainEntityData
{
    public Guid Project { get; set; }
    public SystemMessage SystemMessage { get; set; }
    public IReadOnlyCollection<ToolSpecification> Tools { get; }
}