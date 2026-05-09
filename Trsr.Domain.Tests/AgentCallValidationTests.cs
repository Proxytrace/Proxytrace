using System.Net;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Completion;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Inference;
using Trsr.Domain.Usage;

namespace Trsr.Domain.Tests;

[TestClass]
public sealed class AgentCallValidationTests : DomainTest<Module>
{
    [TestMethod]
    public async Task CreateNew_WithValidInputs_CreatesAgentCall()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgentCall.CreateNew>();
        var completionFactory = services.GetRequiredService<ICompletion.Create>();
        var request = Conversation.Create();
        var response = completionFactory(
            new AssistantMessage([Content.FromText("Hello")], []),
            new TokenUsage(100, 50),
            TimeSpan.FromSeconds(1));
        var agent = await GetOrCreate<IAgent>(services);
        var endpoint = await GetOrCreate<IModelEndpoint>(services);

        // Act
        var agentCall = factory(
            agent: agent,
            endpoint: endpoint,
            request: request,
            response: response,
            httpStatus: HttpStatusCode.OK,
            finishReason: "stop",
            errorMessage: null,
            conversationId: null);

        // Assert
        agentCall.Should().NotBeNull();
        agentCall.Agent.Should().Be(agent);
        agentCall.Endpoint.Should().Be(endpoint);
        agentCall.Request.Should().Be(request);
        agentCall.Response.Should().Be(response);
        agentCall.HttpStatus.Should().Be(HttpStatusCode.OK);
        agentCall.Id.Should().NotBe(Guid.Empty);
        agentCall.CreatedAt.Should().NotBe(default);
        agentCall.UpdatedAt.Should().NotBe(default);
    }

    [TestMethod]
    public async Task CreateNew_WithOptionalAgent_CreatesAgentCall()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgentCall.CreateNew>();
        var completionFactory = services.GetRequiredService<ICompletion.Create>();
        var agent = await GetOrCreate<IAgent>(services);
        var endpoint = await GetOrCreate<IModelEndpoint>(services);

        var request = Conversation.Create();
        var response = completionFactory(
            new AssistantMessage([Content.FromText("Hello")], []),
            new TokenUsage(100, 50),
            TimeSpan.FromSeconds(1));

        // Act
        var agentCall = factory(
            agent: agent,
            endpoint: endpoint,
            request: request,
            response: response,
            httpStatus: HttpStatusCode.OK,
            finishReason: "stop",
            errorMessage: null,
            conversationId: null);

        // Assert
        agentCall.Agent.Should().Be(agent);
    }

    [TestMethod]
    public async Task CreateNew_WithNullRequest_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgentCall.CreateNew>();
        var completionFactory = services.GetRequiredService<ICompletion.Create>();
        var response = completionFactory(
            new AssistantMessage([Content.FromText("Hello")], []),
            new TokenUsage(100, 50),
            TimeSpan.FromSeconds(1));
        var agent = await GetOrCreate<IAgent>(services);
        var endpoint = await GetOrCreate<IModelEndpoint>(services);

        // Act & Assert
        var action = () => factory.DynamicInvoke(
            agent,
            endpoint,
            null,
            response,
            HttpStatusCode.OK,
            "stop",
            null,
            null,
            null);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateExisting_WithValidData_CreatesAgentCall()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<IAgentCall.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();
        var existing = await generator.CreateAsync(CancellationToken);

        // Act
        var agentCall = createExisting(
            existing.Agent,
            existing.Endpoint,
            existing.Request,
            existing.Response,
            existing.HttpStatus,
            existing.FinishReason,
            existing.ErrorMessage,
            existing.ModelParameters,
            existing,
            conversationId: null);

        // Assert
        agentCall.Should().NotBeNull();
        agentCall.Id.Should().Be(existing.Id);
        agentCall.Agent.Should().Be(existing.Agent);
        agentCall.Endpoint.Should().Be(existing.Endpoint);
        agentCall.CreatedAt.Should().Be(existing.CreatedAt);
        agentCall.UpdatedAt.Should().Be(existing.UpdatedAt);
    }

    [TestMethod]
    public async Task Id_IsUniqueForEachNewAgentCall()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgentCall.CreateNew>();
        var completionFactory = services.GetRequiredService<ICompletion.Create>();
        var request = Conversation.Create();
        var response = completionFactory(
            new AssistantMessage([Content.FromText("Hello")], []),
            new TokenUsage(100, 50),
            TimeSpan.FromSeconds(1));
        var agent = await GetOrCreate<IAgent>(services);
        var endpoint = await GetOrCreate<IModelEndpoint>(services);

        // Act
        var agentCall1 = factory(agent, endpoint, request, response, HttpStatusCode.OK, "stop", null, null);
        var agentCall2 = factory(agent, endpoint, request, response, HttpStatusCode.OK, "stop", null, null);

        // Assert
        agentCall1.Id.Should().NotBe(agentCall2.Id);
    }
}
