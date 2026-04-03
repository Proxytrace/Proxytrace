using System.Net;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Message;
using Trsr.Domain.Organization;
using Trsr.Domain.Project;
using Trsr.Domain.Usage;
using Trsr.Domain.User;
using Trsr.Testing;

namespace Trsr.Domain.Tests;

[TestClass]
public sealed class AgentCallValidationTests : BaseTest<Module>
{
    [TestMethod]
    public void CreateNew_WithValidInputs_CreatesAgentCall()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgentCall.CreateNew>();
        var request = Conversation.Create();
        var response = new AssistantMessage([Content.FromText("Hello")], []);
        var usage = new TokenUsage(100, 50);

        // Act
        var agentCall = factory(
            model: "gpt-4o",
            provider: "openai",
            request: request,
            response: response,
            usage: usage,
            duration: TimeSpan.FromSeconds(1),
            httpStatus: HttpStatusCode.OK,
            finishReason: "stop",
            errorMessage: null);

        // Assert
        agentCall.Should().NotBeNull();
        agentCall.Model.Should().Be("gpt-4o");
        agentCall.Provider.Should().Be("openai");
        agentCall.Request.Should().Be(request);
        agentCall.Response.Should().Be(response);
        agentCall.HttpStatus.Should().Be(HttpStatusCode.OK);
        agentCall.Agent.Should().BeNull();
        agentCall.Id.Should().NotBe(Guid.Empty);
        agentCall.CreatedAt.Should().NotBe(default);
        agentCall.UpdatedAt.Should().NotBe(default);
    }

    [TestMethod]
    public void CreateNew_WithOptionalAgent_CreatesAgentCall()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgentCall.CreateNew>();
        var agent = CreateTestAgent(services);
        var request = Conversation.Create();
        var response = new AssistantMessage([Content.FromText("Hello")], []);
        var usage = new TokenUsage(100, 50);

        // Act
        var agentCall = factory(
            model: "gpt-4o",
            provider: "openai",
            request: request,
            response: response,
            usage: usage,
            duration: TimeSpan.FromSeconds(1),
            httpStatus: HttpStatusCode.OK,
            finishReason: "stop",
            errorMessage: null,
            agent: agent);

        // Assert
        agentCall.Agent.Should().Be(agent);
    }

    [TestMethod]
    public void CreateNew_WithNullRequest_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgentCall.CreateNew>();
        var response = new AssistantMessage([Content.FromText("Hello")], []);
        var usage = new TokenUsage(100, 50);

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(
            model: "gpt-4o",
            provider: "openai",
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
    public void CreateNew_WithNullResponse_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgentCall.CreateNew>();
        var request = Conversation.Create();
        var usage = new TokenUsage(100, 50);

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(
            model: "gpt-4o",
            provider: "openai",
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
    public void CreateNew_WithNullModel_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgentCall.CreateNew>();
        var request = Conversation.Create();
        var response = new AssistantMessage([Content.FromText("Hello")], []);
        var usage = new TokenUsage(100, 50);

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(
            model: null!,
            provider: "openai",
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
    public void CreateNew_WithWhitespaceModel_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgentCall.CreateNew>();
        var request = Conversation.Create();
        var response = new AssistantMessage([Content.FromText("Hello")], []);
        var usage = new TokenUsage(100, 50);

        // Act & Assert
        var action = () => factory(
            model: "   ",
            provider: "openai",
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
    public void CreateNew_WithNullProvider_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgentCall.CreateNew>();
        var request = Conversation.Create();
        var response = new AssistantMessage([Content.FromText("Hello")], []);
        var usage = new TokenUsage(100, 50);

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(
            model: "gpt-4o",
            provider: null!,
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
            existing.Model,
            existing.Provider,
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
        agentCall.Model.Should().Be(existing.Model);
        agentCall.Provider.Should().Be(existing.Provider);
        agentCall.CreatedAt.Should().Be(existing.CreatedAt);
        agentCall.UpdatedAt.Should().Be(existing.UpdatedAt);
    }

    [TestMethod]
    public void Id_IsUniqueForEachNewAgentCall()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgentCall.CreateNew>();
        var request = Conversation.Create();
        var response = new AssistantMessage([Content.FromText("Hello")], []);
        var usage = new TokenUsage(100, 50);

        // Act
        var agentCall1 = factory("gpt-4o", "openai", request, response, usage, TimeSpan.FromSeconds(1), HttpStatusCode.OK, "stop", null);
        var agentCall2 = factory("gpt-4o", "openai", request, response, usage, TimeSpan.FromSeconds(1), HttpStatusCode.OK, "stop", null);

        // Assert
        agentCall1.Id.Should().NotBe(agentCall2.Id);
    }

    private static IAgent CreateTestAgent(IServiceProvider services)
    {
        var userFactory = services.GetRequiredService<IUser.CreateNew>();
        var orgFactory = services.GetRequiredService<IOrganization.CreateNew>();
        var projectFactory = services.GetRequiredService<IProject.CreateNew>();
        var agentFactory = services.GetRequiredService<IAgent.CreateNew>();
        var systemMessage = new SystemMessage("You are a helpful assistant");
        var user = userFactory("Test User");
        var org = orgFactory("Test Org", [user]);
        var project = projectFactory("Test Project", org);
        return agentFactory(systemMessage, [], "gpt-4o", "openai", project);
    }
}
