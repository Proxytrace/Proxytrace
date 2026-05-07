using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Organization;
using Trsr.Domain.Project;
using Trsr.Testing;

namespace Trsr.Domain.Tests;

[TestClass]
public sealed class ProjectValidationTests : BaseTest<Module>
{
    [TestMethod]
    public async Task CreateNew_WithValidNameAndOrganization_CreatesProject()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var name = "Test Project";
        var organization = CreateTestOrganization(services);
        var endpoint = await GetEndpointAsync(services);

        // Act
        var project = factory(name, endpoint, organization);

        // Assert
        project.Should().NotBeNull();
        project.Name.Should().Be(name);
        project.Organization.Should().Be(organization);
        project.Id.Should().NotBe(Guid.Empty);
        project.CreatedAt.Should().NotBe(default);
        project.UpdatedAt.Should().NotBe(default);
    }

    [TestMethod]
    public async Task CreateNew_WithNullName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var organization = CreateTestOrganization(services);
        var endpoint = await GetEndpointAsync(services);

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(null!, endpoint, organization);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_WithEmptyName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var organization = CreateTestOrganization(services);
        var endpoint = await GetEndpointAsync(services);

        // Act & Assert
        var action = () => factory(string.Empty, endpoint, organization);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_WithWhitespaceName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var organization = CreateTestOrganization(services);
        var endpoint = await GetEndpointAsync(services);

        // Act & Assert
        var action = () => factory("   ", endpoint, organization);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_WithTabsName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var organization = CreateTestOrganization(services);
        var endpoint = await GetEndpointAsync(services);

        // Act & Assert
        var action = () => factory("\t\t\t", endpoint, organization);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_WithNullOrganization_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var endpoint = await GetEndpointAsync(services);

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory("Test Project", endpoint, null!);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_WithBothInvalidNameAndOrganization_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var endpoint = await GetEndpointAsync(services);

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(string.Empty, endpoint, null!);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateExisting_WithValidData_CreatesProject()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<IProject.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IProject>>();
        var existingProject = await generator.CreateAsync(CancellationToken);

        // Act
        var project = createExisting(existingProject.Name, existingProject.SystemEndpoint, existingProject.Organization, existingProject);

        // Assert
        project.Should().NotBeNull();
        project.Id.Should().Be(existingProject.Id);
        project.Name.Should().Be(existingProject.Name);
        project.Organization.Should().Be(existingProject.Organization);
        project.CreatedAt.Should().Be(existingProject.CreatedAt);
        project.UpdatedAt.Should().Be(existingProject.UpdatedAt);
    }

    [TestMethod]
    public async Task CreateExisting_WithInvalidName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<IProject.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IProject>>();
        var existingProject = await generator.CreateAsync(CancellationToken);

        // Act & Assert
        var action = () => createExisting(string.Empty, existingProject.SystemEndpoint, existingProject.Organization, existingProject);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateExisting_WithNullOrganization_ThrowsException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<IProject.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IProject>>();
        var existingProject = await generator.CreateAsync(CancellationToken);

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => createExisting(existingProject.Name, existingProject.SystemEndpoint, null!, existingProject);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task Id_IsUniqueForEachNewProject()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var organization = CreateTestOrganization(services);
        var endpoint = await GetEndpointAsync(services);

        // Act
        var project1 = factory("Project 1", endpoint, organization);
        var project2 = factory("Project 2", endpoint, organization);

        // Assert
        project1.Id.Should().NotBe(project2.Id);
    }

    [TestMethod]
    public async Task CreateNew_MultipleProjectsForSameOrganization_Succeeds()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var organization = CreateTestOrganization(services);
        var endpoint = await GetEndpointAsync(services);

        // Act
        var project1 = factory("Project 1", endpoint, organization);
        var project2 = factory("Project 2", endpoint, organization);
        var project3 = factory("Project 3", endpoint, organization);

        // Assert
        project1.Organization.Should().Be(organization);
        project2.Organization.Should().Be(organization);
        project3.Organization.Should().Be(organization);
        project1.Id.Should().NotBe(project2.Id);
        project2.Id.Should().NotBe(project3.Id);
        project1.Id.Should().NotBe(project3.Id);
    }

    [TestMethod]
    public async Task CreateNew_WithLongName_CreatesProject()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var organization = CreateTestOrganization(services);
        var endpoint = await GetEndpointAsync(services);

        // Act
        var project = factory(new string('A', 1000), endpoint, organization);

        // Assert
        project.Should().NotBeNull();
        project.Name.Should().Be(new string('A', 1000));
    }

    [TestMethod]
    public async Task CreateNew_WithSpecialCharactersInName_CreatesProject()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var organization = CreateTestOrganization(services);
        var endpoint = await GetEndpointAsync(services);

        // Act
        var project = factory("Project @#$% 123 !&*()", endpoint, organization);

        // Assert
        project.Should().NotBeNull();
        project.Name.Should().Be("Project @#$% 123 !&*()");
    }

    [TestMethod]
    public async Task CreateNew_WithUnicodeCharactersInName_CreatesProject()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var organization = CreateTestOrganization(services);
        var endpoint = await GetEndpointAsync(services);

        // Act
        var project = factory("项目 José Müller", endpoint, organization);

        // Assert
        project.Should().NotBeNull();
        project.Name.Should().Be("项目 José Müller");
    }

    [TestMethod]
    public async Task Project_IsImmutable()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IProject>>();
        var project = await generator.CreateAsync(CancellationToken);

        // Act & Assert
        var nameProperty = project.GetType().GetProperty("Name");
        nameProperty.Should().NotBeNull();
        nameProperty.SetMethod.Should().BeNull(); // No setter, or init-only
    }

    private static IOrganization CreateTestOrganization(IServiceProvider services)
        => services.GetRequiredService<IOrganization.CreateNew>()("Test Organization", []);

    private async Task<IModelEndpoint> GetEndpointAsync(IServiceProvider services)
        => await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync(CancellationToken);
}
