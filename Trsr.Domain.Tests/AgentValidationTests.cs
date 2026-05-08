using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.Agent;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;

namespace Trsr.Domain.Tests;

[TestClass]
public sealed class AgentValidationTests : DomainTest<Module>
{
    [TestMethod]
    public async Task CreateNew_WithValidInputs_CreatesAgent()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgent.CreateNew>();
        var promptTemplateFactory = services.GetRequiredService<IPromptTemplate.Create>();
        var systemPrompt = promptTemplateFactory("Test Agent", "You are a helpful assistant");
        var project = await CreateTestProjectAsync(services);
        var endpoint = await GetOrCreate<IModelEndpoint>(services);

        // Act
        var agent = factory(
            "Test Agent",
            systemPrompt,
            [],
            endpoint,
            project);

        // Assert
        agent.Should().NotBeNull();
        agent.Name.Should().Be("Test Agent");
        agent.SystemPrompt.Should().Be(systemPrompt);
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
        var project = await CreateTestProjectAsync(services);
        var endpoint = await GetOrCreate<IModelEndpoint>(services);

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory("Test Agent", null!, [], endpoint, project);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_WithNullProject_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgent.CreateNew>();
        var promptTemplateFactory = services.GetRequiredService<IPromptTemplate.Create>();
        var systemPrompt = promptTemplateFactory("Test Agent", "You are a helpful assistant");
        var endpoint = await GetOrCreate<IModelEndpoint>(services);

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory("Test Agent", systemPrompt, [], endpoint, null!);
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
        var agent = createExisting(
            existingAgent.Name,
            existingAgent.Project,
            existingAgent.SystemPrompt,
            existingAgent.Tools,
            existingAgent.Endpoint,
            existingAgent.IsSystemAgent,
            existingAgent.ModelParameters,
            existingAgent);

        // Assert
        agent.Should().NotBeNull();
        agent.Id.Should().Be(existingAgent.Id);
        agent.Name.Should().Be(existingAgent.Name);
        agent.Project.Should().Be(existingAgent.Project);
        agent.SystemPrompt.Should().Be(existingAgent.SystemPrompt);
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
        var action = () => createExisting(existingAgent.Name, null!, existingAgent.SystemPrompt, existingAgent.Tools, existingAgent.Endpoint, existingAgent.IsSystemAgent, existingAgent.ModelParameters, existingAgent);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task Id_IsUniqueForEachNewAgent()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IAgent.CreateNew>();
        var promptTemplateFactory = services.GetRequiredService<IPromptTemplate.Create>();
        var systemPrompt = promptTemplateFactory("Test Agent", "You are a helpful assistant");
        var project = await CreateTestProjectAsync(services);
        var endpoint = await GetOrCreate<IModelEndpoint>(services);

        // Act
        var agent1 = factory("Agent One", systemPrompt, [], endpoint, project);
        var agent2 = factory("Agent Two", systemPrompt, [], endpoint, project);

        // Assert
        agent1.Id.Should().NotBe(agent2.Id);
    }

    private async Task<IProject> CreateTestProjectAsync(IServiceProvider services)
    {
        var projectFactory = services.GetRequiredService<IProject.CreateNew>();
        var endpoint = await GetOrCreate<IModelEndpoint>(services);
        return projectFactory("Test Project", endpoint, []);
    }
}
