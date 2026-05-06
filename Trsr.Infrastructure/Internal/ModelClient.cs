using System.ClientModel;
using System.Text.Json;
using Microsoft.Extensions.AI;
using OpenAI;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Usage;
using Trsr.Serialization;

namespace Trsr.Infrastructure.Internal;

internal class ModelClient : IModelClient
{
    private readonly IModelEndpoint endpoint;
    private readonly IOutputFormat.Create outputFormatFactory;
    private readonly IChatClient chatClient;

    public ModelClient(
        IModelEndpoint endpoint,
        IOutputFormat.Create outputFormatFactory)
        : this(endpoint, outputFormatFactory, CreateChatClient(endpoint))
    {
    }

    internal ModelClient(
        IModelEndpoint endpoint,
        IOutputFormat.Create outputFormatFactory,
        IChatClient chatClient)
    {
        this.endpoint = endpoint;
        this.outputFormatFactory = outputFormatFactory;
        this.chatClient = chatClient;
    }

    public async Task<Completion> CompleteAsync(
        Conversation conversation,
        ModelOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        options ??= ModelOptions.FromModel(endpoint.Model);

        ChatResponse response = await chatClient.GetResponseAsync(
            conversation.ToChatMessages(),
            options.ToChatOptions(),
            cancellationToken);

        var toolRequests = response
            .Messages
            .SelectMany(m => m.Contents)
            .OfType<FunctionCallContent>()
            .Select(fc => new ToolRequest(
                fc.CallId,
                fc.Name,
                fc.Arguments is not null ? JsonSerializer.Serialize(fc.Arguments) : "{}"))
            .ToList();

        var responseContents = new List<Content>();
        if (!string.IsNullOrWhiteSpace(response.Text))
            responseContents.Add(Content.FromText(response.Text));

        var message = Message.CreateAssistantMessage(
            contents: responseContents,
            toolRequests: toolRequests);

        TokenUsage? usage = null;
        if (response.Usage is { InputTokenCount: not null, OutputTokenCount: not null })
        {
            usage = new TokenUsage(
                (ulong)response.Usage.InputTokenCount.Value,
                (ulong)response.Usage.OutputTokenCount.Value);
        }

        return new Completion(message, usage);
    }

    public async Task<TOutput?> CompleteAsync<TOutput>(
        Conversation conversation,
        ModelOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        IOutputFormat outputFormat = outputFormatFactory(typeof(TOutput));
        Completion completion = await CompleteAsync(conversation, options, cancellationToken);
        return await outputFormat.ParseAsync<TOutput>(completion.Response.GetTextResponse(), cancellationToken);
    }

    private static IChatClient CreateChatClient(IModelEndpoint endpoint)
    {
        if (endpoint.Provider.Kind is not ModelProviderKind.OpenAi and not ModelProviderKind.OpenAiCompatible)
        {
            throw new NotSupportedException($"Model provider kind {endpoint.Provider.Kind} is not supported");
        }

        var credential = new ApiKeyCredential(endpoint.Provider.ApiKey);
        var options = new OpenAIClientOptions { Endpoint = endpoint.Provider.Endpoint };
        return new OpenAIClient(credential, options)
            .GetChatClient(endpoint.Model.Name)
            .AsIChatClient();
    }
}