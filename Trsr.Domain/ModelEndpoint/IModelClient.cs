using Trsr.Domain.Agent;
using Trsr.Domain.Completion;
using Trsr.Domain.Message;
using Trsr.Domain.Model;
using Trsr.Domain.Tools;
using Trsr.Domain.Usage;

namespace Trsr.Domain.ModelEndpoint;

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

    Task<TOutput?> CompleteAsync<TOutput>(
        Conversation conversation,
        ModelOptions? options = null,
        IReadOnlyDictionary<string, string>? promptVariables = null,
        CancellationToken cancellationToken = default);
}