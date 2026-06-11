using Proxytrace.Domain.AgentVersion;
using Proxytrace.Domain.Inference;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.Prompt;
using Proxytrace.Domain.Search;
using Proxytrace.Domain.Tools;

namespace Proxytrace.Domain.Agent;

/// <summary>
/// Represents an AI agent. Identity is the (project, name) pair. The agent's prompt and tool-set
/// live on its <see cref="IAgentVersion"/> history; <see cref="CurrentVersion"/> is the version
/// currently in effect (latest, unless pinned).
/// </summary>
public interface IAgent : IDomainEntity<IAgent>, ISearchable, IArchivable
{
    /// <summary>Short human-readable name generated from the system message at creation time.</summary>
    string Name { get; }

    /// <summary>
    /// The endpoint the agent completes against.
    /// </summary>
    IModelEndpoint Endpoint { get; }

    /// <summary>
    /// The latest version of this agent. Always non-null for agents observed by external callers:
    /// the <see cref="CreateNew"/> factory stitches in v1 before returning, and agents loaded from
    /// storage carry their current version (storage invariant).
    /// </summary>
    IAgentVersion CurrentVersion { get; }

    /// <summary>The system prompt of <see cref="CurrentVersion"/>.</summary>
    IPromptTemplate SystemPrompt { get; }

    /// <summary>The tools of <see cref="CurrentVersion"/>.</summary>
    IReadOnlyList<ToolSpecification> Tools { get; }

    /// <summary>
    /// Sampling and decoding parameters last seen for this agent. Not part of the version identity.
    /// </summary>
    IModelParameters ModelParameters { get; }

    /// <summary>
    /// Whether the agent is a built-in agent (e.g. for prompt optimization).
    /// </summary>
    bool IsSystemAgent { get; }

    SearchKind ISearchable.SearchKind => SearchKind.Agent;

    public delegate IAgent CreateNew(
        string name,
        IPromptTemplate systemPrompt,
        IReadOnlyList<ToolSpecification> tools,
        IModelEndpoint endpoint,
        IProject project,
        IModelParameters modelParameters,
        bool isSystemAgent = false);

    public delegate IAgent CreateExisting(
        string name,
        IProject project,
        IModelEndpoint endpoint,
        bool isSystemAgent,
        IModelParameters modelParameters,
        IAgentVersion currentVersion,
        IDomainEntityData existing);

    IModelClient CreateClient(
        IModelEndpoint? customEndpoint = null,
        bool skipIngestion = false);

    /// <summary>
    /// Creates a new <see cref="IAgentVersion"/> for this agent with the given prompt and tools,
    /// makes it the current version (unless the agent is pinned), and returns the updated agent.
    /// </summary>
    Task<IAgent> CreateNewVersionAsync(
        IPromptTemplate systemPrompt,
        IReadOnlyList<ToolSpecification> tools,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Backwards-compatible alias for <see cref="CreateNewVersionAsync"/> that updates only the prompt.
    /// </summary>
    Task<IAgent> ChangeSystemMessage(
        IPromptTemplate systemPrompt,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Backwards-compatible alias for <see cref="CreateNewVersionAsync"/> that updates only the tools.
    /// </summary>
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
