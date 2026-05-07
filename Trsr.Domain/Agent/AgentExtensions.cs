using Trsr.Domain.Completion;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Agent;

/// <summary>
/// Extensions for <see cref="IAgent"/>
/// </summary>
public static class AgentExtensions
{
    public static Task<ICompletion> CompleteAsync(
        this IAgent agent,
        UserMessage userMessage,
        IModelEndpoint? endpoint = null,
        IReadOnlyDictionary<string, string>? variables = null,
        CancellationToken cancellationToken = default)
    {
        Conversation conversation = Conversation.Create();
        conversation.Add(userMessage);
        return agent.CompleteAsync(
            conversation, 
            endpoint, 
            variables,
            cancellationToken);
    }
}