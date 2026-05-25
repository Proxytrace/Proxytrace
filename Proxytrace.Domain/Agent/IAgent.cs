using Proxytrace.Domain.Inference;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.Prompt;
using Proxytrace.Domain.Search;
using Proxytrace.Domain.Tools;

namespace Proxytrace.Domain.Agent;

/// <summary>
/// Represents an AI agent defined by a system message, tools, model endpoint, and project.
/// The combination of these fields forms a stable fingerprint that uniquely identifies an agent version.
/// </summary>
public interface IAgent : IDomainEntity<IAgent>, ISearchable
{
    /// <summary>Short human-readable name generated from the system message at creation time.</summary>
    string Name { get; }

    /// <summary>
    /// The endpoint the agent completes against
    /// </summary>
    IModelEndpoint Endpoint { get; }

    /// <summary>The system message that defines this agent's behaviour.</summary>
    IPromptTemplate SystemPrompt { get; }

    /// <summary>The tools available to this agent.</summary>
    IReadOnlyList<ToolSpecification> Tools { get; }

    /// <summary>
    /// Sampling and decoding parameters last seen for this agent. Not part of the fingerprint.
    /// </summary>
    IModelParameters ModelParameters { get; }

    /// <summary>
    /// Whether the agent is a built-in agent (e.g. for prompt optimization)
    /// </summary>
    bool IsSystemAgent { get; }
    
    SearchKind ISearchable.SearchKind => SearchKind.Agent;

    /// <summary>Factory delegate for creating a new agent.</summary>
    public delegate IAgent CreateNew(
        string name,
        IPromptTemplate systemPrompt,
        IReadOnlyList<ToolSpecification> tools,
        IModelEndpoint endpoint,
        IProject project,
        IModelParameters modelParameters,
        bool isSystemAgent = false);

    /// <summary>Factory delegate for reconstituting an existing agent from persistence.</summary>
    public delegate IAgent CreateExisting(
        string name,
        IProject project,
        IPromptTemplate systemPrompt,
        IReadOnlyList<ToolSpecification> tools,
        IModelEndpoint endpoint,
        bool isSystemAgent,
        IModelParameters modelParameters,
        IDomainEntityData existing);

    /// <summary>
    /// Gets an chat client instance
    /// </summary>
    IModelClient CreateClient(
        IModelEndpoint? customEndpoint = null,
        bool skipIngestion = false);

    Task<IAgent> ChangeSystemMessage(
        IPromptTemplate systemPrompt,
        CancellationToken cancellationToken = default);
    
    Task<IAgent> ChangeTools(
        IReadOnlyList<ToolSpecification> tools,
        CancellationToken cancellationToken = default);
    
    Task<IAgent> ChangeEndpoint(
        IModelEndpoint modelEndpoint,
        CancellationToken cancellationToken = default);

    Task<IAgent> ChangeModelParameters(
        IModelParameters modelParameters,
        CancellationToken cancellationToken = default);

    SystemMessage CreateSystemMessage(
        IReadOnlyDictionary<string, string>? variables = null);
}
