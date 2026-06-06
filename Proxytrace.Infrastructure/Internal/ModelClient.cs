using System.ClientModel;
using System.Diagnostics;
using System.Net;
using System.Runtime.CompilerServices;
using System.Text.Json;
using Microsoft.Extensions.AI;
using OpenAI;
using Proxytrace.Application.Demo;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.Completion;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Usage;
using Proxytrace.Serialization;

namespace Proxytrace.Infrastructure.Internal;

internal class ModelClient : IModelClient
{
    private readonly IAgent agent;
    private readonly bool skipIngestion;
    private readonly KioskOptions kioskOptions;
    private readonly ICompletion.Create completionFactory;
    private readonly IAgentCall.CreateNew agentCallFactory;
    private readonly IModelEndpoint endpoint;
    private readonly IOutputFormat.Create outputFormatFactory;
    private readonly IChatClient chatClient;

    public ModelClient(
        IAgent agent,
        IModelEndpoint? customEndpoint,
        bool skipIngestion,
        KioskOptions kioskOptions,
        ICompletion.Create completionFactory,
        IAgentCall.CreateNew agentCallFactory,
        IOutputFormat.Create outputFormatFactory)
    {
        endpoint = customEndpoint ?? agent.Endpoint;
        this.agent = agent;
        this.skipIngestion = skipIngestion;
        this.kioskOptions = kioskOptions;
        this.completionFactory = completionFactory;
        this.agentCallFactory = agentCallFactory;
        this.outputFormatFactory = outputFormatFactory;
        chatClient = CreateChatClient(endpoint);
    }

    internal ModelClient(
        IAgent agent,
        IModelEndpoint? customEndpoint,
        KioskOptions kioskOptions,
        ICompletion.Create completionFactory,
        IAgentCall.CreateNew agentCallFactory,
        IOutputFormat.Create outputFormatFactory,
        IChatClient chatClient)
    {
        endpoint = customEndpoint ?? agent.Endpoint;
        this.agent = agent;
        this.kioskOptions = kioskOptions;
        this.completionFactory = completionFactory;
        this.agentCallFactory = agentCallFactory;
        this.outputFormatFactory = outputFormatFactory;
        this.chatClient = chatClient;
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

    public async Task<TypedCompletion<TOutput>> CompleteAsync<TOutput>(
        Conversation conversation,
        ModelOptions? options = null,
        IReadOnlyDictionary<string, string>? promptVariables = null,
        CancellationToken cancellationToken = default)
    {
        IOutputFormat outputFormat = outputFormatFactory(typeof(TOutput));

        SystemMessage systemMessage = agent.CreateSystemMessage(promptVariables);

        systemMessage = new SystemMessage($"""
                                           {systemMessage}
                                           {outputFormat.ToPromptString()}
                                           """);

        ICompletion completion = await CompleteAsync(
            systemMessage,
            conversation,
            options,
            cancellationToken);

        TOutput? output = await outputFormat.ParseAsync<TOutput>(
            completion.Response.GetTextResponse(),
            cancellationToken);

        return new TypedCompletion<TOutput>(output, completion.Usage, completion.Latency);
    }

    public ModelRequestPreview BuildRequestPreview(
        Conversation conversation,
        ModelOptions? options = null,
        IReadOnlyDictionary<string, string>? promptVariables = null)
    {
        SystemMessage systemMessage = agent.CreateSystemMessage(promptVariables);
        options ??= ModelOptions.FromAgent(agent, endpoint.Model);
        conversation = Conversation.ReplaceSystemMessage(conversation, systemMessage);

        var messages = conversation.Messages.Select(ToPreviewMessage).ToList();
        var tools = options.Tools
            .Select(t => new RequestToolPreview(t.Name, t.Description, t.Arguments.JsonSchema))
            .ToList();

        return new ModelRequestPreview(endpoint.Model.Name, messages, tools);
    }

    private static RequestMessagePreview ToPreviewMessage(Message message)
    {
        var role = message.Role.ToString().ToLowerInvariant();

        if (message is AssistantMessage { ToolRequests.Count: > 0 } assistant)
        {
            var calls = assistant.ToolRequests
                .Select(tr => new RequestToolCallPreview(tr.Id, tr.Name, tr.Arguments))
                .ToList();
            return new RequestMessagePreview(role, NullIfEmpty(assistant.GetText()), calls, null);
        }

        if (message is ToolMessage toolMessage)
        {
            var (id, contents) = toolMessage.Deconstruct();
            var content = string.Concat(contents.Select(c => c.Text ?? string.Empty));
            return new RequestMessagePreview(role, content, [], id);
        }

        return new RequestMessagePreview(role, NullIfEmpty(message.GetText()), [], null);
    }

    private static string? NullIfEmpty(string text) => string.IsNullOrEmpty(text) ? null : text;

    private async Task<ICompletion> CompleteAsync(
        SystemMessage systemMessage,
        Conversation conversation,
        ModelOptions? options,
        CancellationToken cancellationToken)
    {
        if (kioskOptions.Enabled)
        {
            throw new InvalidOperationException(
                "Model calls are disabled in kiosk mode. This instance of ModelClient is not functional.");
        }
        
        options ??= ModelOptions.FromAgent(agent, endpoint.Model);
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

        if (!skipIngestion)
        {
            HttpStatusCode statusCode = error != null ? HttpStatusCode.InternalServerError : HttpStatusCode.OK;
            IAgentCall agentCall = agentCallFactory(agent, agent.CurrentVersion, endpoint, conversation, completion, statusCode);
            await agentCall.AddAsync(cancellationToken);
        }

        if (error is not null)
        {
            throw error;
        }

        return completion
               ?? throw new InvalidOperationException(
                   "Completion is null after successful response. This should not happen.");
    }

    public async IAsyncEnumerable<ModelStreamUpdate> StreamAsync(
        SystemMessage systemMessage,
        Conversation conversation,
        ModelOptions? options = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        options ??= ModelOptions.FromAgent(agent, endpoint.Model);
        conversation = Conversation.ReplaceSystemMessage(conversation, systemMessage);

        Stopwatch sw = Stopwatch.StartNew();
        TokenUsage? usage = null;
        string? finishReason = null;
        var emittedToolCallIds = new HashSet<string>();

        IAsyncEnumerable<ChatResponseUpdate> stream = chatClient.GetStreamingResponseAsync(
            conversation.ToChatMessages(),
            options.ToChatOptions(),
            cancellationToken);

        await foreach (ChatResponseUpdate update in stream)
        {
            foreach (AIContent content in update.Contents)
            {
                if (content is TextContent text && !string.IsNullOrEmpty(text.Text))
                {
                    yield return new TextDelta(text.Text);
                }
                else if (content is FunctionCallContent fc)
                {
                    if (string.IsNullOrEmpty(fc.CallId) || !emittedToolCallIds.Add(fc.CallId))
                        continue;

                    var args = fc.Arguments is not null ? JsonSerializer.Serialize(fc.Arguments) : "{}";
                    yield return new ToolRequested(new ToolRequest(fc.CallId, fc.Name, args));
                }
                else if (content is UsageContent { Details: { InputTokenCount: not null, OutputTokenCount: not null } } uc)
                {
                    usage = new TokenUsage(
                        (ulong)uc.Details.InputTokenCount.Value,
                        (ulong)uc.Details.OutputTokenCount.Value);
                }
            }

            if (update.FinishReason is { } reason)
            {
                finishReason = reason.Value;
            }
        }

        yield return new Completed(usage, sw.Elapsed, finishReason);
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