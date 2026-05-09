using System.Reflection;
using System.Text.Json;
using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Message;
using Trsr.Domain.Model;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Tools;
using Trsr.Infrastructure.Internal;
using Trsr.Serialization;
using Trsr.Testing;

namespace Trsr.Infrastructure.Tests;

[TestClass]
public sealed class ModelClientTests : BaseTest<Module>
{
    protected override void ConfigureContainer(ContainerBuilder builder)
    {
        // Expose the internal constructor so Autofac uses it when IChatClient is registered.
        builder.RegisterType<ModelClient>()
            .FindConstructorsWith(t => t.GetConstructors(
                BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance))
            .As<IModelClient>();

        IOutputFormat DefaultFactory(Type _) => Substitute.For<IOutputFormat>();
        builder.RegisterInstance((IOutputFormat.Create)DefaultFactory);

        var agentCallRepo = Substitute.For<IRepository<IAgentCall>>();
        agentCallRepo.AddAsync(Arg.Any<IAgentCall>(), Arg.Any<CancellationToken>())
            .Returns(call => Task.FromResult(call.Arg<IAgentCall>()));
        builder.RegisterInstance(agentCallRepo).As<IRepository<IAgentCall>>();
    }

    // ── registration helpers ──────────────────────────────────────────────────

    private static void RegisterEndpoint(
        ContainerBuilder builder,
        string modelName = "gpt-4o",
        ModelProviderKind kind = ModelProviderKind.OpenAi,
        string apiKey = "sk-test",
        string endpointUrl = "https://api.openai.com/v1")
    {
        var endpoint = MakeEndpoint(modelName, kind, apiKey, endpointUrl);
        builder.RegisterInstance(endpoint).As<IModelEndpoint>();
        builder.RegisterInstance(MakeAgent(endpoint)).As<IAgent>();
    }

    private static void RegisterChatClient(ContainerBuilder builder, ChatResponse response)
        => builder.RegisterInstance(MakeChatClient(response)).As<IChatClient>();

    // ── object factories ──────────────────────────────────────────────────────

    private static IModelEndpoint MakeEndpoint(
        string modelName = "gpt-4o",
        ModelProviderKind kind = ModelProviderKind.OpenAi,
        string apiKey = "sk-test",
        string endpointUrl = "https://api.openai.com/v1")
    {
        IModel model = Substitute.For<IModel>();
        model.Name.Returns(modelName);

        IModelProvider provider = Substitute.For<IModelProvider>();
        provider.Kind.Returns(kind);
        provider.ApiKey.Returns(apiKey);
        provider.Endpoint.Returns(new Uri(endpointUrl));

        IModelEndpoint ep = Substitute.For<IModelEndpoint>();
        ep.Model.Returns(model);
        ep.Provider.Returns(provider);

        return ep;
    }

    private static IAgent MakeAgent(IModelEndpoint endpoint)
    {
        IAgent agent = Substitute.For<IAgent>();
        agent.Endpoint.Returns(endpoint);
        agent.Tools.Returns([]);
        agent.CreateSystemMessage(Arg.Any<IReadOnlyDictionary<string, string>?>())
            .Returns(new SystemMessage([Content.FromText("test system")]));
        return agent;
    }

    private static IChatClient MakeChatClient(ChatResponse response)
    {
        IChatClient client = Substitute.For<IChatClient>();
        client.GetResponseAsync(
                Arg.Any<IEnumerable<ChatMessage>>(),
                Arg.Any<ChatOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(response));
        return client;
    }

    private static ChatResponse TextResponse(string text)
        => new([new ChatMessage(ChatRole.Assistant, text)]);

    private static ChatResponse FunctionCallResponse(
        string callId,
        string name,
        IDictionary<string, object?>? arguments)
    {
        var fc = new FunctionCallContent(callId, name, arguments);
        return new ChatResponse([new ChatMessage(ChatRole.Assistant, new List<AIContent> { fc })]);
    }

    private static ChatResponse MixedResponse(
        string text,
        string callId,
        string name,
        IDictionary<string, object?>? arguments)
    {
        var fc = new FunctionCallContent(callId, name, arguments);
        return new ChatResponse([
            new ChatMessage(ChatRole.Assistant, new List<AIContent> { new TextContent(text), fc })
        ]);
    }

    private static Conversation SimpleConversation(string userText = "Hello")
    {
        var conv = Conversation.Create();
        conv.Add(Message.CreateUserMessage(userText));
        return conv;
    }

    // ── CompleteAsync (non-generic) ───────────────────────────────────────────

    [TestMethod]
    public async Task CompleteAsync_WithTextResponse_ReturnsAssistantMessageWithText()
    {
        const string expectedText = "The answer is 42.";
        var services = GetServices(config =>
        {
            RegisterEndpoint(config);
            RegisterChatClient(config, TextResponse(expectedText));
        });

        var client = services.GetRequiredService<IModelClient>();
        var result = await client.CompleteAsync(SimpleConversation(), cancellationToken: CancellationToken);

        result.Response.Contents.Should().ContainSingle()
            .Which.Text.Should().Be(expectedText);
        result.Response.ToolRequests.Should().BeEmpty();
    }

    [TestMethod]
    public async Task CompleteAsync_WithWhitespaceResponse_ReturnsAssistantMessageWithNoContents()
    {
        var services = GetServices(config =>
        {
            RegisterEndpoint(config);
            RegisterChatClient(config, TextResponse("   "));
        });

        var client = services.GetRequiredService<IModelClient>();
        var result = await client.CompleteAsync(SimpleConversation(), cancellationToken: CancellationToken);

        result.Response.Contents.Should().BeEmpty();
        result.Response.ToolRequests.Should().BeEmpty();
    }

    [TestMethod]
    public async Task CompleteAsync_WithEmptyResponse_ReturnsAssistantMessageWithNoContents()
    {
        var services = GetServices(config =>
        {
            RegisterEndpoint(config);
            RegisterChatClient(config, TextResponse(""));
        });

        var client = services.GetRequiredService<IModelClient>();
        var result = await client.CompleteAsync(SimpleConversation(), cancellationToken: CancellationToken);

        result.Response.Contents.Should().BeEmpty();
    }

    [TestMethod]
    public async Task CompleteAsync_WithSingleFunctionCall_ReturnsCorrectToolRequest()
    {
        var args = new Dictionary<string, object?> { ["query"] = "Paris" };
        var services = GetServices(config =>
        {
            RegisterEndpoint(config);
            RegisterChatClient(config, FunctionCallResponse("call-1", "web_search", args));
        });

        var client = services.GetRequiredService<IModelClient>();
        var result = await client.CompleteAsync(SimpleConversation(), cancellationToken: CancellationToken);

        result.Response.ToolRequests.Should().ContainSingle();
        result.Response.ToolRequests[0].Id.Should().Be("call-1");
        result.Response.ToolRequests[0].Name.Should().Be("web_search");
        result.Response.Contents.Should().BeEmpty();
    }

    [TestMethod]
    public async Task CompleteAsync_WithFunctionCallArguments_SerializesArgumentsToJson()
    {
        var args = new Dictionary<string, object?> { ["city"] = "London", ["unit"] = "celsius" };
        var services = GetServices(config =>
        {
            RegisterEndpoint(config);
            RegisterChatClient(config, FunctionCallResponse("call-2", "get_weather", args));
        });

        var client = services.GetRequiredService<IModelClient>();
        var result = await client.CompleteAsync(SimpleConversation(), cancellationToken: CancellationToken);

        var argsJson = result.Response.ToolRequests[0].Arguments;
        using var doc = JsonDocument.Parse(argsJson);
        doc.RootElement.GetProperty("city").GetString().Should().Be("London");
        doc.RootElement.GetProperty("unit").GetString().Should().Be("celsius");
    }

    [TestMethod]
    public async Task CompleteAsync_WithNullFunctionCallArguments_SerializesAsEmptyJsonObject()
    {
        var services = GetServices(config =>
        {
            RegisterEndpoint(config);
            RegisterChatClient(config, FunctionCallResponse("call-3", "no_args_tool", null));
        });

        var client = services.GetRequiredService<IModelClient>();
        var result = await client.CompleteAsync(SimpleConversation(), cancellationToken: CancellationToken);

        result.Response.ToolRequests[0].Arguments.Should().Be("{}");
    }

    [TestMethod]
    public async Task CompleteAsync_WithMultipleFunctionCalls_ReturnsAllToolRequests()
    {
        var fc1 = new FunctionCallContent("id-1", "tool_a");
        var fc2 = new FunctionCallContent("id-2", "tool_b");
        var fc3 = new FunctionCallContent("id-3", "tool_c");
        var response = new ChatResponse([
            new ChatMessage(ChatRole.Assistant, new List<AIContent> { fc1, fc2, fc3 })
        ]);
        var services = GetServices(config =>
        {
            RegisterEndpoint(config);
            RegisterChatClient(config, response);
        });

        var client = services.GetRequiredService<IModelClient>();
        var result = await client.CompleteAsync(SimpleConversation(), cancellationToken: CancellationToken);

        result.Response.ToolRequests.Should().HaveCount(3);
        result.Response.ToolRequests.Select(r => r.Id).Should().ContainInOrder("id-1", "id-2", "id-3");
        result.Response.ToolRequests.Select(r => r.Name).Should().ContainInOrder("tool_a", "tool_b", "tool_c");
    }

    [TestMethod]
    public async Task CompleteAsync_WithTextAndFunctionCall_ReturnsBothContentAndToolRequest()
    {
        const string text = "I will search for that.";
        var args = new Dictionary<string, object?> { ["q"] = "capital of France" };
        var services = GetServices(config =>
        {
            RegisterEndpoint(config);
            RegisterChatClient(config, MixedResponse(text, "call-4", "search", args));
        });

        var client = services.GetRequiredService<IModelClient>();
        var result = await client.CompleteAsync(SimpleConversation(), cancellationToken: CancellationToken);

        result.Response.Contents.Should().ContainSingle().Which.Text.Should().Be(text);
        result.Response.ToolRequests.Should().ContainSingle().Which.Name.Should().Be("search");
    }

    [TestMethod]
    public async Task CompleteAsync_WithFunctionCallsAcrossMultipleMessages_CollectsAllRequests()
    {
        var fc1 = new FunctionCallContent("id-a", "tool_1");
        var fc2 = new FunctionCallContent("id-b", "tool_2");
        var response = new ChatResponse([
            new ChatMessage(ChatRole.Assistant, new List<AIContent> { fc1 }),
            new ChatMessage(ChatRole.Assistant, new List<AIContent> { fc2 }),
        ]);
        var services = GetServices(config =>
        {
            RegisterEndpoint(config);
            RegisterChatClient(config, response);
        });

        var client = services.GetRequiredService<IModelClient>();
        var result = await client.CompleteAsync(SimpleConversation(), cancellationToken: CancellationToken);

        result.Response.ToolRequests.Should().HaveCount(2);
        result.Response.ToolRequests.Select(r => r.Id).Should().ContainInOrder("id-a", "id-b");
    }

    [TestMethod]
    public async Task CompleteAsync_WhenNoOptionsProvided_UsesEndpointModelNameInChatOptions()
    {
        const string modelName = "gpt-4o-mini";
        ChatOptions? capturedOptions = null;

        IChatClient chatClient = Substitute.For<IChatClient>();
        chatClient.GetResponseAsync(
                Arg.Any<IEnumerable<ChatMessage>>(),
                Arg.Do<ChatOptions>(o => capturedOptions = o),
                Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(TextResponse("ok")));

        var services = GetServices(config =>
        {
            RegisterEndpoint(config, modelName: modelName);
            config.RegisterInstance(chatClient).As<IChatClient>();
        });

        var client = services.GetRequiredService<IModelClient>();
        await client.CompleteAsync(SimpleConversation(), cancellationToken: CancellationToken);

        capturedOptions.Should().NotBeNull();
        capturedOptions.ModelId.Should().Be(modelName);
    }

    [TestMethod]
    public async Task CompleteAsync_WhenOptionsProvided_UsesProvidedModelName()
    {
        const string overrideName = "o3";
        ChatOptions? capturedOptions = null;

        IChatClient chatClient = Substitute.For<IChatClient>();
        chatClient.GetResponseAsync(
                Arg.Any<IEnumerable<ChatMessage>>(),
                Arg.Do<ChatOptions>(o => capturedOptions = o),
                Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(TextResponse("ok")));

        var services = GetServices(config =>
        {
            RegisterEndpoint(config);
            config.RegisterInstance(chatClient).As<IChatClient>();
        });

        var client = services.GetRequiredService<IModelClient>();
        await client.CompleteAsync(SimpleConversation(), new ModelOptions(overrideName, []), cancellationToken: CancellationToken);

        capturedOptions?.ModelId.Should().Be(overrideName);
    }

    [TestMethod]
    public async Task CompleteAsync_WhenOptionsHaveTools_PassesToolsToChatOptions()
    {
        var tool = new ToolSpecification("my_tool", "Does something useful", ToolArguments.None);
        ChatOptions? capturedOptions = null;

        IChatClient chatClient = Substitute.For<IChatClient>();
        chatClient.GetResponseAsync(
                Arg.Any<IEnumerable<ChatMessage>>(),
                Arg.Do<ChatOptions>(o => capturedOptions = o),
                Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(TextResponse("done")));

        var services = GetServices(config =>
        {
            RegisterEndpoint(config);
            config.RegisterInstance(chatClient).As<IChatClient>();
        });

        var client = services.GetRequiredService<IModelClient>();
        await client.CompleteAsync(SimpleConversation(), new ModelOptions("gpt-4o", [tool]), cancellationToken: CancellationToken);

        capturedOptions?.Tools.Should().ContainSingle()
            .Which.Name.Should().Be("my_tool");
    }

    [TestMethod]
    public async Task CompleteAsync_ForwardsCancellationToken()
    {
        using var cts = new CancellationTokenSource();
        CancellationToken capturedToken = CancellationToken.None;

        IChatClient chatClient = Substitute.For<IChatClient>();
        chatClient.GetResponseAsync(
                Arg.Any<IEnumerable<ChatMessage>>(),
                Arg.Any<ChatOptions>(),
                Arg.Do<CancellationToken>(ct => capturedToken = ct))
            .Returns(Task.FromResult(TextResponse("ok")));

        var services = GetServices(config =>
        {
            RegisterEndpoint(config);
            config.RegisterInstance(chatClient).As<IChatClient>();
        });

        var client = services.GetRequiredService<IModelClient>();
        await client.CompleteAsync(SimpleConversation(), cancellationToken: cts.Token);

        capturedToken.Should().Be(cts.Token);
    }

    [TestMethod]
    public async Task CompleteAsync_ForwardsConversationMessagesToChatClient()
    {
        IEnumerable<ChatMessage>? capturedMessages = null;

        IChatClient chatClient = Substitute.For<IChatClient>();
        chatClient.GetResponseAsync(
                Arg.Do<IEnumerable<ChatMessage>>(m => capturedMessages = m),
                Arg.Any<ChatOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(TextResponse("ok")));

        var services = GetServices(config =>
        {
            RegisterEndpoint(config);
            config.RegisterInstance(chatClient).As<IChatClient>();
        });

        var conversation = Conversation.Create();
        conversation.Add(Message.CreateUserMessage("What is 2+2?"));

        var client = services.GetRequiredService<IModelClient>();
        await client.CompleteAsync(conversation, cancellationToken: CancellationToken);

        capturedMessages.Should().HaveCount(2);
        var messages = capturedMessages ?? throw new InvalidOperationException("Expected captured messages.");
        messages.First().Role.Should().Be(ChatRole.System);
        messages.Last().Role.Should().Be(ChatRole.User);
    }

    // ── CompleteAsync<TOutput> (generic) ─────────────────────────────────────

    [TestMethod]
    public async Task CompleteAsync_Typed_InvokesOutputFormatFactoryWithCorrectType()
    {
        Type? capturedType = null;
        IOutputFormat outputFormat = Substitute.For<IOutputFormat>();
        outputFormat.ParseAsync<string>(Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromResult<string?>("parsed"));

        IOutputFormat.Create factory = t =>
        {
            capturedType = t;
            return outputFormat;
        };

        var services = GetServices(config =>
        {
            RegisterEndpoint(config);
            RegisterChatClient(config, TextResponse("raw text"));
            config.RegisterInstance(factory);
        });

        var client = services.GetRequiredService<IModelClient>();
        await client.CompleteAsync<string>(SimpleConversation(), cancellationToken: CancellationToken);

        capturedType.Should().Be(typeof(string));
    }

    [TestMethod]
    public async Task CompleteAsync_Typed_ForwardsTextResponseToParseAsync()
    {
        const string rawText = "hello world";
        string? capturedInput = null;
        IOutputFormat outputFormat = Substitute.For<IOutputFormat>();
        outputFormat.ParseAsync<string>(
                Arg.Do<string?>(s => capturedInput = s),
                Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromResult<string?>("parsed"));

        var services = GetServices(config =>
        {
            RegisterEndpoint(config);
            RegisterChatClient(config, TextResponse(rawText));
            config.RegisterInstance<IOutputFormat.Create>(_ => outputFormat);
        });

        var client = services.GetRequiredService<IModelClient>();
        await client.CompleteAsync<string>(SimpleConversation(), cancellationToken: CancellationToken);

        capturedInput.Should().Be(rawText);
    }

    [TestMethod]
    public async Task CompleteAsync_Typed_ReturnsResultFromParseAsync()
    {
        const string expected = "structured output";
        IOutputFormat outputFormat = Substitute.For<IOutputFormat>();
        outputFormat.ParseAsync<string>(Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromResult<string?>(expected));

        var services = GetServices(config =>
        {
            RegisterEndpoint(config);
            RegisterChatClient(config, TextResponse("raw"));
            config.RegisterInstance<IOutputFormat.Create>(_ => outputFormat);
        });

        var client = services.GetRequiredService<IModelClient>();
        string? result = await client.CompleteAsync<string>(SimpleConversation(), cancellationToken: CancellationToken);

        result.Should().Be(expected);
    }

    [TestMethod]
    public async Task CompleteAsync_Typed_ReturnsNullWhenParseAsyncReturnsNull()
    {
        IOutputFormat outputFormat = Substitute.For<IOutputFormat>();
        outputFormat.ParseAsync<string>(Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<string?>(null));

        var services = GetServices(config =>
        {
            RegisterEndpoint(config);
            RegisterChatClient(config, TextResponse("irrelevant"));
            config.RegisterInstance<IOutputFormat.Create>(_ => outputFormat);
        });

        var client = services.GetRequiredService<IModelClient>();
        string? result = await client.CompleteAsync<string>(SimpleConversation(), cancellationToken: CancellationToken);

        result.Should().BeNull();
    }

    [TestMethod]
    public async Task CompleteAsync_Typed_ThrowsWhenResponseContainsToolRequests()
    {
        var fc = new FunctionCallContent("id-x", "some_tool");
        var response = new ChatResponse([
            new ChatMessage(ChatRole.Assistant, new List<AIContent> { fc })
        ]);

        var services = GetServices(config =>
        {
            RegisterEndpoint(config);
            RegisterChatClient(config, response);
        });

        var client = services.GetRequiredService<IModelClient>();
        await FluentActions
            .Invoking(() => client.CompleteAsync<string>(SimpleConversation(), cancellationToken: CancellationToken))
            .Should().ThrowAsync<InvalidOperationException>();
    }

    [TestMethod]
    public async Task CompleteAsync_Typed_ForwardsCancellationTokenToParseAsync()
    {
        using var cts = new CancellationTokenSource();
        CancellationToken capturedToken = CancellationToken.None;
        IOutputFormat outputFormat = Substitute.For<IOutputFormat>();
        outputFormat.ParseAsync<string>(
                Arg.Any<string?>(),
                Arg.Do<CancellationToken>(ct => capturedToken = ct))
            .Returns(Task.FromResult<string?>("ok"));

        var services = GetServices(config =>
        {
            RegisterEndpoint(config);
            RegisterChatClient(config, TextResponse("ok"));
            config.RegisterInstance<IOutputFormat.Create>(_ => outputFormat);
        });

        var client = services.GetRequiredService<IModelClient>();
        await client.CompleteAsync<string>(SimpleConversation(), cancellationToken: cts.Token);

        capturedToken.Should().Be(cts.Token);
    }

    [TestMethod]
    public async Task CompleteAsync_Typed_UsesProvidedOptionsWhenForwarding()
    {
        const string overrideModel = "claude-3-5-sonnet";
        ChatOptions? capturedOptions = null;

        IChatClient chatClient = Substitute.For<IChatClient>();
        chatClient.GetResponseAsync(
                Arg.Any<IEnumerable<ChatMessage>>(),
                Arg.Do<ChatOptions>(o => capturedOptions = o),
                Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(TextResponse("result")));

        IOutputFormat outputFormat = Substitute.For<IOutputFormat>();
        outputFormat.ParseAsync<string>(Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<string?>("result"));

        var services = GetServices(config =>
        {
            RegisterEndpoint(config);
            config.RegisterInstance(chatClient).As<IChatClient>();
            config.RegisterInstance<IOutputFormat.Create>(_ => outputFormat);
        });

        var client = services.GetRequiredService<IModelClient>();
        await client.CompleteAsync<string>(SimpleConversation(), new ModelOptions(overrideModel, []), cancellationToken: CancellationToken);

        capturedOptions.Should().NotBeNull();
        capturedOptions.ModelId.Should().Be(overrideModel);
    }

    // ── Constructor / provider kind validation ────────────────────────────────

    [TestMethod]
    public void Constructor_WithAnthropicProviderKind_ThrowsNotSupportedException()
    {
        var services = GetServices();
        IModelEndpoint endpoint = MakeEndpoint(kind: ModelProviderKind.Anthropic);
        var factory = services.GetRequiredService<IModelClient.Factory>();

        FluentActions
            .Invoking(() => factory(MakeAgent(endpoint)))
            .Should()
            .Throw<Exception>();
    }

    [TestMethod]
    public void Constructor_WithUnknownProviderKind_ThrowsNotSupportedException()
    {
        var services = GetServices();
        var endpoint = MakeEndpoint(kind: ModelProviderKind.Unknown);
        var factory = services.GetRequiredService<IModelClient.Factory>();

        FluentActions
            .Invoking(() => factory(MakeAgent(endpoint)))
            .Should().Throw<Exception>();
    }

    [TestMethod]
    public void Constructor_WithOpenAiProviderKind_DoesNotThrow()
    {
        var services = GetServices();
        var endpoint = MakeEndpoint(kind: ModelProviderKind.OpenAi);
        var factory = services.GetRequiredService<IModelClient.Factory>();

        FluentActions
            .Invoking(() => factory(MakeAgent(endpoint)))
            .Should().NotThrow();
    }

    [TestMethod]
    public void Constructor_WithOpenAiCompatibleProviderKind_DoesNotThrow()
    {
        var services = GetServices();
        var endpoint = MakeEndpoint(
            kind: ModelProviderKind.OpenAiCompatible,
            endpointUrl: "https://openrouter.ai/api/v1");
        var factory = services.GetRequiredService<IModelClient.Factory>();

        FluentActions
            .Invoking(() => factory(MakeAgent(endpoint)))
            .Should().NotThrow();
    }
}
