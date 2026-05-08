using Trsr.Domain.Inference;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;
using Trsr.Domain.Tools;

namespace Trsr.Domain.Agent;

/// <summary>
/// Repository for <see cref="IAgent"/> entities with agent-specific lookup operations.
/// </summary>
public interface IAgentRepository : IRepository<IAgent>
{
    /// <summary>
    /// Returns the agent matching the given system message and tools, creating one if it does not yet exist.
    /// When a new agent is created, its name is generated via <see cref="IAgentNameGenerator"/>
    /// using the supplied <paramref name="endpoint"/>.
    /// </summary>
    Task<IAgent> GetOrCreateAsync(
        IPromptTemplate systemPrompt,
        IReadOnlyList<ToolSpecification> tools,
        IProject project,
        IModelEndpoint endpoint,
        string? name = null,
        bool isSystemAgent = false,
        IModelParameters? modelParameters = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Computes a stable fingerprint for an agent defined by the given fields.
    /// The fingerprint changes when any of system message, tools, model, or provider changes.
    /// </summary>
    string GetAgentFingerprint(
        IPromptTemplate systemPrompt,
        IReadOnlyCollection<ToolSpecification> tools);

    /// <summary>
    /// Computes a stable fingerprint for the given <paramref name="agent"/>.
    /// </summary>
    string GetAgentFingerprint(IAgent agent);
}
