using System.ClientModel;
using System.Diagnostics;
using System.Text.Json;
using Microsoft.Extensions.AI;
using OpenAI;
using Trsr.Domain.Completion;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Usage;
using Trsr.Serialization;

namespace Trsr.Infrastructure.Internal;

internal class ModelClient : IModelClient
{
    private readonly ICompletion.Create completionFactory;
    private readonly IModelEndpoint endpoint;
    private readonly IOutputFormat.Create outputFormatFactory;
    private readonly IChatClient chatClient;

    public ModelClient(
        IModelEndpoint endpoint,
        ICompletion.Create completionFactory,
        IOutputFormat.Create outputFormatFactory)
        : this(endpoint, completionFactory, outputFormatFactory, CreateChatClient(endpoint))
    {
        this.completionFactory = completionFactory;
    }

    internal ModelClient(
        IModelEndpoint endpoint,
        ICompletion.Create completionFactory,
        IOutputFormat.Create outputFormatFactory,
        IChatClient chatClient)
    {
        this.endpoint = endpoint;
        this.completionFactory = completionFactory;
        this.outputFormatFactory = outputFormatFactory;
        this.chatClient = chatClient;
    }

    public async Task<ICompletion> CompleteAsync(
        Conversation conversation,
        ModelOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        options ??= ModelOptions.FromModel(endpoint.Model);

        Stopwatch sw = Stopwatch.StartNew();
        ChatResponse response = await chatClient.GetResponseAsync(
            conversation.ToChatMessages(),
            options.ToChatOptions(),
            cancellationToken);
        TimeSpan latency = sw.Elapsed;

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
        
        var completion = completionFactory(message, usage, latency);
        return completion;
    }

    public async Task<TOutput?> CompleteAsync<TOutput>(
        Conversation conversation,
        ModelOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        IOutputFormat outputFormat = outputFormatFactory(typeof(TOutput));

        var systemMessage = conversation.SystemMessage;
        
        // add expected output format to system message
        systemMessage = new SystemMessage($"""
                                            {systemMessage}
                                            {outputFormat.ToPromptString()}
                                            """);
        
        conversation = Conversation.ReplaceSystemMessage(conversation, systemMessage);
        
        ICompletion completion = await CompleteAsync(
            conversation,
            options,
            cancellationToken);
        
        return await outputFormat.ParseAsync<TOutput>(
            completion.Response.GetTextResponse(),
            cancellationToken);
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