using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Domain.Organization;
using Trsr.Domain.Project;
using Trsr.Domain.User;
using Trsr.Testing;

namespace Trsr.Domain.Tests;

[TestClass]
public sealed class AgentValidationTests : BaseTest<Module>
{
    [TestMethod]
    public async Task CreateNew_WithValidInputs_CreatesAgent()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgent.CreateNew>();
        var systemMessage = new SystemMessage("You are a helpful assistant");
        var project = CreateTestProject(services);

        // Act
        var agent = factory("Test Agent", systemMessage, [], project);

        // Assert
        agent.Should().NotBeNull();
        agent.Name.Should().Be("Test Agent");
        agent.SystemMessage.Should().Be(systemMessage);
        agent.Project.Should().Be(project);
        agent.Id.Should().NotBe(Guid.Empty);
        agent.CreatedAt.Should().NotBe(default);
        agent.UpdatedAt.Should().NotBe(default);
    }

    [TestMethod]
    public async Task CreateNew_WithNullSystemMessage_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgent.CreateNew>();
        var project = CreateTestProject(services);

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory("Test Agent", null!, [], project);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_WithNullProject_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgent.CreateNew>();
        var systemMessage = new SystemMessage("You are a helpful assistant");

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory("Test Agent", systemMessage, [], null!);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateExisting_WithValidData_CreatesAgent()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<IAgent.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IAgent>>();
        var existingAgent = await generator.CreateAsync(CancellationToken);

        // Act
        var agent = createExisting(existingAgent.Name, existingAgent.Project, existingAgent.SystemMessage, existingAgent.Tools, existingAgent);

        // Assert
        agent.Should().NotBeNull();
        agent.Id.Should().Be(existingAgent.Id);
        agent.Name.Should().Be(existingAgent.Name);
        agent.Project.Should().Be(existingAgent.Project);
        agent.SystemMessage.Should().Be(existingAgent.SystemMessage);
        agent.CreatedAt.Should().Be(existingAgent.CreatedAt);
        agent.UpdatedAt.Should().Be(existingAgent.UpdatedAt);
    }

    [TestMethod]
    public async Task CreateExisting_WithNullProject_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<IAgent.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IAgent>>();
        var existingAgent = await generator.CreateAsync(CancellationToken);

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => createExisting(existingAgent.Name, null!, existingAgent.SystemMessage, existingAgent.Tools, existingAgent);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task Id_IsUniqueForEachNewAgent()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgent.CreateNew>();
        var systemMessage = new SystemMessage("You are a helpful assistant");
        var project = CreateTestProject(services);

        // Act
        var agent1 = factory("Agent 1", systemMessage, [], project);
        var agent2 = factory("Agent 2", systemMessage, [], project);

        // Assert
        agent1.Id.Should().NotBe(agent2.Id);
    }

    private static IProject CreateTestProject(IServiceProvider services)
    {
        var userFactory = services.GetRequiredService<IUser.CreateNew>();
        var orgFactory = services.GetRequiredService<IOrganization.CreateNew>();
        var projectFactory = services.GetRequiredService<IProject.CreateNew>();
        var user = userFactory("Test User");
        var org = orgFactory("Test Org", [user]);
        return projectFactory("Test Project", org);
    }
}
