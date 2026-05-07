using System.ClientModel;
using System.Diagnostics;
using System.Net;
using System.Text.Json;
using Microsoft.Extensions.AI;
using OpenAI;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Completion;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Usage;
using Trsr.Serialization;

namespace Trsr.Infrastructure.Internal;

internal class ModelClient : IModelClient
{
    private readonly IAgent agent;
    private readonly ICompletion.Create completionFactory;
    private readonly IAgentCall.CreateNew agentCallFactory;
    private readonly IModelEndpoint endpoint;
    private readonly IOutputFormat.Create outputFormatFactory;
    private readonly IChatClient chatClient;

    public ModelClient(
        IAgent agent,
        IModelEndpoint? customEndpoint,
        ICompletion.Create completionFactory,
        IAgentCall.CreateNew agentCallFactory,
        IOutputFormat.Create outputFormatFactory)
    {
        this.endpoint = customEndpoint ?? agent.Endpoint;
        this.agent = agent;
        this.completionFactory = completionFactory;
        this.agentCallFactory = agentCallFactory;
        this.outputFormatFactory = outputFormatFactory;
        chatClient = CreateChatClient(endpoint);
    }

    public Task<ICompletion> CompleteAsync(
        Conversation conversation,
        ModelOptions? options = null,
        IReadOnlyDictionary<string, string>? promptVariables = null,
        CancellationToken cancellationToken = default)
    {
        SystemMessage systemMessage = agent.CreateSystemMessage(promptVariables);
        return CompleteAsync(systemMessage, conversation, options, cancellationToken);
    }

    public async Task<TOutput?> CompleteAsync<TOutput>(
        Conversation conversation,
        ModelOptions? options = null,
        IReadOnlyDictionary<string, string>? promptVariables = null,
        CancellationToken cancellationToken = default)
    {
        IOutputFormat outputFormat = outputFormatFactory(typeof(TOutput));

        SystemMessage systemMessage = agent.CreateSystemMessage(promptVariables);

        // add expected output format to system message
        systemMessage = new SystemMessage($"""
                                           {systemMessage}
                                           {outputFormat.ToPromptString()}
                                           """);

        ICompletion completion = await CompleteAsync(
            systemMessage,
            conversation, 
            options,
            cancellationToken);

        return await outputFormat.ParseAsync<TOutput>(
            completion.Response.GetTextResponse(),
            cancellationToken);
    }
    
    private async Task<ICompletion> CompleteAsync(
        SystemMessage systemMessage,
        Conversation conversation,
        ModelOptions? options,
        CancellationToken cancellationToken)
    {
        options ??= ModelOptions.FromModel(endpoint.Model);
        conversation = Conversation.ReplaceSystemMessage(conversation, systemMessage);

        ICompletion? completion = null;
        Exception? error = null;
        Stopwatch sw = Stopwatch.StartNew();
        try
        {
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

            completion = completionFactory(message, usage, latency);
        }
        catch (Exception ex)
        {
            error = ex;
        }

        HttpStatusCode statusCode = error != null ? HttpStatusCode.InternalServerError : HttpStatusCode.OK;
        IAgentCall agentCall = agentCallFactory(agent, endpoint, conversation, completion, statusCode);
        await agentCall.AddAsync(cancellationToken);

        if (error is not null)
        {
            throw error;
        }

        return completion 
               ?? throw new InvalidOperationException("Completion is null after successful response. This should not happen.");
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