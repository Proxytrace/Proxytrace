using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Domain.Tools;

namespace Trsr.Domain.Agent;

/// <summary>
/// Represents an AI agent defined by a system message, tools, model endpoint, and project.
/// The combination of these fields forms a stable fingerprint that uniquely identifies an agent version.
/// </summary>
public interface IAgent : IDomainEntity
{
    /// <summary>The project this agent belongs to.</summary>
    IProject Project { get; }

    /// <summary>The system message that defines this agent's behaviour.</summary>
    SystemMessage SystemMessage { get; }

    /// <summary>The tools available to this agent.</summary>
    IReadOnlyCollection<ToolSpecification> Tools { get; }

    /// <summary>Factory delegate for creating a new agent.</summary>
    public delegate IAgent CreateNew(
        SystemMessage systemMessage,
        IReadOnlyCollection<ToolSpecification> tools,
        IProject project);

    /// <summary>Factory delegate for reconstituting an existing agent from persistence.</summary>
    public delegate IAgent CreateExisting(
        IProject project,
        SystemMessage systemMessage,
        IReadOnlyCollection<ToolSpecification> tools,
        IDomainEntityData existing);
}
