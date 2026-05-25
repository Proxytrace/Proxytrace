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

public interface IModelClient
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