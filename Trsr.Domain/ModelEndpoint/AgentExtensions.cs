using Trsr.Domain.Completion;
using Trsr.Domain.Message;

namespace Trsr.Domain.ModelEndpoint;

/// <summary>
/// Extensions for <see cref="IModelClient"/>
/// </summary>
public static class ModelClientExtensions
{
    public static Task<ICompletion> CompleteAsync(
        this IModelClient client,
        UserMessage userMessage,
        ModelOptions? modelOptions = null,
        IReadOnlyDictionary<string, string>? variables = null,
        CancellationToken cancellationToken = default)
    {
        Conversation conversation = Conversation.Create();
        conversation.Add(userMessage);
        return client.CompleteAsync(
            conversation, 
            modelOptions,
            variables,
            cancellationToken);
    }

    public static Task<TOutput?> CompleteAsync<TOutput>(
        this IModelClient client,
        UserMessage userMessage,
        ModelOptions? modelOptions = null,
        IReadOnlyDictionary<string, string>? variables = null,
        CancellationToken cancellationToken = default)
    {
        Conversation conversation = Conversation.Create();
        conversation.Add(userMessage);
        return client.CompleteAsync<TOutput>(
            conversation, 
            modelOptions, 
            variables,
            cancellationToken);
    }
}