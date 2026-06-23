using Proxytrace.Domain.Agent;
using Proxytrace.Domain.Completion;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.Model;
using Proxytrace.Domain.Tools;
using Proxytrace.Domain.Usage;

namespace Proxytrace.Domain.ModelEndpoint;

public record ModelOptions(
    string ModelName,
    IReadOnlyList<ToolSpecification> Tools)
{

    public static ModelOptions FromModel(IModel model)
        => new(
            ModelName: model.Name,
            Tools: []);

    public static ModelOptions FromAgent(IAgent agent, IModel model)
        => new(
            ModelName: model.Name,
            Tools: agent.Tools);
}

public record TypedCompletion<TOutput>(TOutput? Response, TokenUsage? Usage, TimeSpan Latency);

/// <summary>
/// A read-only snapshot of the exact request a <see cref="IModelClient"/> would send to the model:
/// the resolved model name, the messages (system prompt already merged in), and the tool definitions.
/// Built without contacting the provider, so it can be inspected for debugging.
/// </summary>
public record ModelRequestPreview(
    string Model,
    IReadOnlyList<RequestMessagePreview> Messages,
    IReadOnlyList<RequestToolPreview> Tools);

public record RequestMessagePreview(
    string Role,
    string? Content,
    IReadOnlyList<RequestToolCallPreview> ToolCalls,
    string? ToolCallId);

public record RequestToolCallPreview(string Id, string Name, string Arguments);

public record RequestToolPreview(string Name, string Description, string JsonSchema);

/// <summary>
/// A model client bound to a single agent + endpoint. Implementations own a disposable provider
/// transport, so callers MUST dispose the client (a <c>using</c>) once done — it is created per
/// call via <see cref="Factory"/> and its underlying chat-client transport is not freed for them.
/// </summary>
public interface IModelClient : IDisposable
{
    public delegate IModelClient Factory(
        IAgent agent,
        IModelEndpoint? customEndpoint = null,
        bool skipIngestion = false);

    Task<ICompletion> CompleteAsync(
        Conversation conversation,
        ModelOptions? options = null,
        IReadOnlyDictionary<string, string>? promptVariables = null,
        CancellationToken cancellationToken = default);

    Task<TypedCompletion<TOutput>> CompleteAsync<TOutput>(
        Conversation conversation,
        ModelOptions? options = null,
        IReadOnlyDictionary<string, string>? promptVariables = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Reconstructs the request that <see cref="CompleteAsync(Conversation, ModelOptions?, IReadOnlyDictionary{string, string}?, CancellationToken)"/>
    /// would send — model, messages (with the agent's system prompt merged in), and tools — without
    /// contacting the provider. Defaults the tools to the agent's toolset, mirroring a real run.
    /// </summary>
    ModelRequestPreview BuildRequestPreview(
        Conversation conversation,
        ModelOptions? options = null,
        IReadOnlyDictionary<string, string>? promptVariables = null);

    /// <summary>
    /// Streams a single completion turn. Caller supplies the system message explicitly so the
    /// agent's stored system prompt can be overridden (Playground use case).
    /// Always runs with skipIngestion behaviour (no <c>IAgentCall</c> recorded).
    /// </summary>
    IAsyncEnumerable<ModelStreamUpdate> StreamAsync(
        SystemMessage systemMessage,
        Conversation conversation,
        ModelOptions? options = null,
        CancellationToken cancellationToken = default);
}