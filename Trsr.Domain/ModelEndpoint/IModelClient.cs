using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Domain.Model;
using Trsr.Domain.Tools;

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
    public delegate IModelClient Factory(IModelEndpoint endpoint);
    
    Task<AssistantMessage> CompleteAsync(
        Conversation conversation,
        ModelOptions? options = null,
        CancellationToken cancellationToken = default);
}