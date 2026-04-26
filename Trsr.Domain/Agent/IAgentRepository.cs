using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Domain.Tools;

namespace Trsr.Domain.Agent;

/// <summary>
/// Repository for <see cref="IAgent"/> entities with agent-specific lookup operations.
/// </summary>
public interface IAgentRepository : IRepository<IAgent>
{
    /// <summary>
    /// Returns the agent matching the given system message, tools, and endpoint,
    /// creating one if it does not yet exist.
    /// </summary>
    Task<IAgent> GetOrCreateAsync(
        SystemMessage systemMessage,
        IReadOnlyCollection<ToolSpecification> tools,
        IProject project,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Computes a stable fingerprint for an agent defined by the given fields.
    /// The fingerprint changes when any of system message, tools, model, or provider changes.
    /// </summary>
    string GetAgentFingerprint(
        SystemMessage systemMessage,
        IReadOnlyCollection<ToolSpecification> tools);

    /// <summary>
    /// Computes a stable fingerprint for the given <paramref name="agent"/>.
    /// </summary>
    string GetAgentFingerprint(IAgent agent);
}
