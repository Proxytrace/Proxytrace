using Trsr.Domain.Message;
using Trsr.Domain.Project;
using Trsr.Domain.Tools;

namespace Trsr.Domain.Agent;

public interface IAgent : IDomainEntity
{
    IProject Project { get; }
    SystemMessage SystemMessage { get; }
    IReadOnlyCollection<ToolSpecification> Tools { get; }

    public delegate IAgent CreateNew(SystemMessage systemMessage, IReadOnlyCollection<ToolSpecification> tools, IProject project);
    public delegate IAgent CreateExisting(IProject project, SystemMessage systemMessage, IReadOnlyCollection<ToolSpecification> tools, IDomainEntityData existing);
}
