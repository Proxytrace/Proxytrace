using Trsr.Domain.Message;

namespace Trsr.Domain.Agent;

public interface IAgentData : IDomainEntityData
{
    public Guid Project { get; set; }
    public SystemMessage SystemMessage { get; set; }
}