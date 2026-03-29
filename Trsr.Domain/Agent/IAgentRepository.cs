using Trsr.Domain.Message;
using Trsr.Domain.Project;
using Trsr.Domain.Tools;

namespace Trsr.Domain.Agent;

public interface IAgentRepository : IRepository<IAgent>
{
    /// <summary>
    /// Returns the agent matching the given system message and tools,
    /// creating one if it does not yet exist.
    /// </summary>
    Task<IAgent> GetOrCreateAsync(
        SystemMessage systemMessage,
        IReadOnlyCollection<ToolSpecification> tools,
        IProject project,
        CancellationToken cancellationToken = default);

    string GetAgentFingerprint(
        SystemMessage systemMessage, 
        IReadOnlyCollection<ToolSpecification> tools);
    
    string GetAgentFingerprint(IAgent agent);
}
