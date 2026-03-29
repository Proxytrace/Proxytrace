using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Domain.Tools;
using Trsr.Testing;

namespace Trsr.Domain.Tests;

[TestClass]
public sealed class AgentValidationTests : BaseTest<Module>
{
    [TestMethod]
    public void CreateNew_WithValidInputs_CreatesAgent()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgent.CreateNew>();
        var systemMessage = new SystemMessage("You are a helpful assistant");
        var projectId = Guid.NewGuid();

        // Act
        var agent = factory(systemMessage, [], projectId);

        // Assert
        agent.Should().NotBeNull();
        agent.SystemMessage.Should().Be(systemMessage);
        agent.Project.Should().Be(projectId);
        agent.Id.Should().NotBe(Guid.Empty);
        agent.CreatedAt.Should().NotBe(default);
        agent.UpdatedAt.Should().NotBe(default);
    }

    [TestMethod]
    public void CreateNew_WithNullSystemMessage_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgent.CreateNew>();
        var projectId = Guid.NewGuid();

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(null!, [], projectId);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithEmptyProjectId_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgent.CreateNew>();
        var systemMessage = new SystemMessage("You are a helpful assistant");

        // Act & Assert
        var action = () => factory(systemMessage, [], Guid.Empty);
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
        var agent = createExisting(existingAgent);

        // Assert
        agent.Should().NotBeNull();
        agent.Id.Should().Be(existingAgent.Id);
        agent.Project.Should().Be(existingAgent.Project);
        agent.SystemMessage.Should().Be(existingAgent.SystemMessage);
        agent.CreatedAt.Should().Be(existingAgent.CreatedAt);
        agent.UpdatedAt.Should().Be(existingAgent.UpdatedAt);
    }

    [TestMethod]
    public async Task CreateExisting_WithInvalidProject_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<IAgent.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IAgent>>();
        var existingAgent = await generator.CreateAsync(CancellationToken);

        var invalidData = new AgentDataStub(existingAgent)
        {
            Project = Guid.Empty
        };

        // Act & Assert
        var action = () => createExisting(invalidData);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void Id_IsUniqueForEachNewAgent()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgent.CreateNew>();
        var systemMessage = new SystemMessage("You are a helpful assistant");
        var projectId = Guid.NewGuid();

        // Act
        var agent1 = factory(systemMessage, [], projectId);
        var agent2 = factory(systemMessage, [], projectId);

        // Assert
        agent1.Id.Should().NotBe(agent2.Id);
    }

    private class AgentDataStub : IAgentData
    {
        public Guid Id { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
        public Guid Project { get; set; }
        public SystemMessage SystemMessage { get; set; }
        // ReSharper disable once MemberInitializerValueIgnored
        public IReadOnlyCollection<ToolSpecification> Tools { get; set; } = [];

        public AgentDataStub(IAgent agent)
        {
            Id = agent.Id;
            CreatedAt = agent.CreatedAt;
            UpdatedAt = agent.UpdatedAt;
            Project = agent.Project;
            SystemMessage = agent.SystemMessage;
            Tools = agent.Tools;
        }
    }
}
