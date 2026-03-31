using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.Organization;
using Trsr.Domain.Project;
using Trsr.Testing;

namespace Trsr.Domain.Tests;

[TestClass]
public sealed class ProjectValidationTests : BaseTest<Module>
{
    [TestMethod]
    public void CreateNew_WithValidNameAndOrganization_CreatesProject()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var name = "Test Project";
        var organization = CreateTestOrganization(services);

        // Act
        var project = factory(name, organization);

        // Assert
        project.Should().NotBeNull();
        project.Name.Should().Be(name);
        project.Organization.Should().Be(organization);
        project.Id.Should().NotBe(Guid.Empty);
        project.CreatedAt.Should().NotBe(default);
        project.UpdatedAt.Should().NotBe(default);
    }

    [TestMethod]
    public void CreateNew_WithNullName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var organization = CreateTestOrganization(services);

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(null!, organization);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithEmptyName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var organization = CreateTestOrganization(services);

        // Act & Assert
        var action = () => factory(string.Empty, organization);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithWhitespaceName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var organization = CreateTestOrganization(services);

        // Act & Assert
        var action = () => factory("   ", organization);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithTabsName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var organization = CreateTestOrganization(services);

        // Act & Assert
        var action = () => factory("\t\t\t", organization);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithNullOrganization_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory("Test Project", null!);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithBothInvalidNameAndOrganization_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(string.Empty, null!);
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
        var project = createExisting(existingProject.Name, existingProject.Organization, existingProject);

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
        var action = () => createExisting(string.Empty, existingProject.Organization, existingProject);
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
        var action = () => createExisting(existingProject.Name, null!, existingProject);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void Id_IsUniqueForEachNewProject()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var organization = CreateTestOrganization(services);

        // Act
        var project1 = factory("Project 1", organization);
        var project2 = factory("Project 2", organization);

        // Assert
        project1.Id.Should().NotBe(project2.Id);
    }

    [TestMethod]
    public void CreateNew_MultipleProjectsForSameOrganization_Succeeds()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var organization = CreateTestOrganization(services);

        // Act
        var project1 = factory("Project 1", organization);
        var project2 = factory("Project 2", organization);
        var project3 = factory("Project 3", organization);

        // Assert
        project1.Organization.Should().Be(organization);
        project2.Organization.Should().Be(organization);
        project3.Organization.Should().Be(organization);
        project1.Id.Should().NotBe(project2.Id);
        project2.Id.Should().NotBe(project3.Id);
        project1.Id.Should().NotBe(project3.Id);
    }

    [TestMethod]
    public void CreateNew_WithLongName_CreatesProject()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var organization = CreateTestOrganization(services);

        // Act
        var project = factory(new string('A', 1000), organization);

        // Assert
        project.Should().NotBeNull();
        project.Name.Should().Be(new string('A', 1000));
    }

    [TestMethod]
    public void CreateNew_WithSpecialCharactersInName_CreatesProject()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var organization = CreateTestOrganization(services);

        // Act
        var project = factory("Project @#$% 123 !&*()", organization);

        // Assert
        project.Should().NotBeNull();
        project.Name.Should().Be("Project @#$% 123 !&*()");
    }

    [TestMethod]
    public void CreateNew_WithUnicodeCharactersInName_CreatesProject()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var organization = CreateTestOrganization(services);

        // Act
        var project = factory("项目 José Müller", organization);

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
}
