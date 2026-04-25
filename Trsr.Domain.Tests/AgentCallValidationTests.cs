using System.Net;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
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
        var request = Conversation.Create();
        var response = new AssistantMessage([Content.FromText("Hello")], []);
        var usage = new TokenUsage(100, 50);
        var agent = await GetOrCreate<IAgent>(services);
        var endpoint = await GetOrCreate<IModelEndpoint>(services);

        // Act
        var agentCall = factory(
            agent: agent,
            endpoint: endpoint,
            request: request,
            response: response,
            usage: usage,
            duration: TimeSpan.FromSeconds(1),
            httpStatus: HttpStatusCode.OK,
            finishReason: "stop",
            errorMessage: null);

        // Assert
        agentCall.Should().NotBeNull();
        agentCall.Agent.Should().Be(agent);
        agentCall.Endpoint.Should().Be(endpoint);
        agentCall.Request.Should().Be(request);
        agentCall.Response.Should().Be(response);
        agentCall.HttpStatus.Should().Be(HttpStatusCode.OK);
        agentCall.Agent.Should().BeNull();
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
        var agent = await GetOrCreate<IAgent>(services);
        var endpoint = await GetOrCreate<IModelEndpoint>(services);

        var request = Conversation.Create();
        var response = new AssistantMessage([Content.FromText("Hello")], []);
        var usage = new TokenUsage(100, 50);
        
        // Act
        var agentCall = factory(
            agent: agent,
            endpoint: endpoint,
            request: request,
            response: response,
            usage: usage,
            duration: TimeSpan.FromSeconds(1),
            httpStatus: HttpStatusCode.OK,
            finishReason: "stop",
            errorMessage: null);

        // Assert
        agentCall.Agent.Should().Be(agent);
    }

    [TestMethod]
    public async Task CreateNew_WithNullRequest_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgentCall.CreateNew>();
        var response = new AssistantMessage([Content.FromText("Hello")], []);
        var usage = new TokenUsage(100, 50);
        var agent = await GetOrCreate<IAgent>(services);
        var endpoint = await GetOrCreate<IModelEndpoint>(services);

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(
            agent: agent,
            endpoint: endpoint,
            request: null!,
            response: response,
            usage: usage,
            duration: TimeSpan.FromSeconds(1),
            httpStatus: HttpStatusCode.OK,
            finishReason: "stop",
            errorMessage: null);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_WithNullResponse_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgentCall.CreateNew>();
        var request = Conversation.Create();
        var usage = new TokenUsage(100, 50);
        var agent = await GetOrCreate<IAgent>(services);
        var endpoint = await GetOrCreate<IModelEndpoint>(services);

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(
            agent: agent,
            endpoint: endpoint,
            request: request,
            response: null!,
            usage: usage,
            duration: TimeSpan.FromSeconds(1),
            httpStatus: HttpStatusCode.OK,
            finishReason: "stop",
            errorMessage: null);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_WithNullModel_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgentCall.CreateNew>();
        var request = Conversation.Create();
        var response = new AssistantMessage([Content.FromText("Hello")], []);
        var usage = new TokenUsage(100, 50);
        var agent = await GetOrCreate<IAgent>(services);
        var endpoint = await GetOrCreate<IModelEndpoint>(services);
        
        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(
            agent: agent,
            endpoint: endpoint,
            request: request,
            response: response,
            usage: usage,
            duration: TimeSpan.FromSeconds(1),
            httpStatus: HttpStatusCode.OK,
            finishReason: "stop",
            errorMessage: null);
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
            existing.Usage,
            existing.Duration,
            existing.HttpStatus,
            existing.FinishReason,
            existing.ErrorMessage,
            existing);

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
        var request = Conversation.Create();
        var response = new AssistantMessage([Content.FromText("Hello")], []);
        var usage = new TokenUsage(100, 50);
        var agent = await GetOrCreate<IAgent>(services);
        var endpoint = await GetOrCreate<IModelEndpoint>(services);
        
        // Act
        var agentCall1 = factory(agent, endpoint, request, response, usage, TimeSpan.FromSeconds(1), HttpStatusCode.OK, "stop", null);
        var agentCall2 = factory(agent, endpoint, request, response, usage, TimeSpan.FromSeconds(1), HttpStatusCode.OK, "stop", null);

        // Assert
        agentCall1.Id.Should().NotBe(agentCall2.Id);
    }
}
