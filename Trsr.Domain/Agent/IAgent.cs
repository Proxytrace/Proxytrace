using Trsr.Domain.Completion;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;
using Trsr.Domain.Tools;

namespace Trsr.Domain.Agent;

/// <summary>
/// Represents an AI agent defined by a system message, tools, model endpoint, and project.
/// The combination of these fields forms a stable fingerprint that uniquely identifies an agent version.
/// </summary>
public interface IAgent : IDomainEntity
{
    /// <summary>Short human-readable name generated from the system message at creation time.</summary>
    string Name { get; }
    
    /// <summary>
    /// The endpoint the agent completes against
    /// </summary>
    IModelEndpoint Endpoint { get; }

    /// <summary>The project this agent belongs to.</summary>
    IProject Project { get; }

    /// <summary>The system message that defines this agent's behaviour.</summary>
    IPromptTemplate SystemPrompt { get; }

    /// <summary>The tools available to this agent.</summary>
    IReadOnlyList<ToolSpecification> Tools { get; }
    
    /// <summary>
    /// Whether the agent is a built-in agent (e.g. for prompt optimization)
    /// </summary>
    bool IsSystemAgent { get; }

    /// <summary>Factory delegate for creating a new agent.</summary>
    public delegate IAgent CreateNew(
        string name,
        IPromptTemplate systemPrompt,
        IReadOnlyList<ToolSpecification> tools,
        IModelEndpoint endpoint,
        IProject project,
        bool isSystemAgent = false);

    /// <summary>Factory delegate for reconstituting an existing agent from persistence.</summary>
    public delegate IAgent CreateExisting(
        string name,
        IProject project,
        IPromptTemplate systemPrompt,
        IReadOnlyList<ToolSpecification> tools,
        IModelEndpoint endpoint,
        bool isSystemAgent,
        IDomainEntityData existing);
    
    /// <summary>
    /// Given a conversation history, complete the next message by calling the language model defined in the provided model endpoint.
    /// </summary>
    Task<ICompletion> CompleteAsync(
        Conversation conversation,
        IModelEndpoint? endpoint = null,
        IReadOnlyDictionary<string, string>? variables = null,
        CancellationToken cancellationToken = default);
    
    Task<TOutput?> CompleteAsync<TOutput>(
        Conversation conversation,
        IModelEndpoint? endpoint = null,
        IReadOnlyDictionary<string, string>? variables = null,
        CancellationToken cancellationToken = default);
    
    Task<IAgent> ChangeEndpoint(
        IModelEndpoint modelEndpoint, 
        CancellationToken cancellationToken = default);

    SystemMessage CreateSystemMessage(IReadOnlyDictionary<string, string>? variables = null);
}
