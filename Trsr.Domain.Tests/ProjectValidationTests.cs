using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
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
        var organizationId = Guid.NewGuid();

        // Act
        var project = factory(name, organizationId);

        // Assert
        project.Should().NotBeNull();
        project.Name.Should().Be(name);
        project.Organization.Should().Be(organizationId);
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
        string? nullName = null;
        var organizationId = Guid.NewGuid();

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(nullName!, organizationId);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithEmptyName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var emptyName = string.Empty;
        var organizationId = Guid.NewGuid();

        // Act & Assert
        var action = () => factory(emptyName, organizationId);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithWhitespaceName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var whitespaceName = "   ";
        var organizationId = Guid.NewGuid();

        // Act & Assert
        var action = () => factory(whitespaceName, organizationId);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithTabsName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var tabsName = "\t\t\t";
        var organizationId = Guid.NewGuid();

        // Act & Assert
        var action = () => factory(tabsName, organizationId);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithEmptyOrganizationId_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var name = "Test Project";
        var emptyOrganizationId = Guid.Empty;

        // Act & Assert
        var action = () => factory(name, emptyOrganizationId);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithDefaultOrganizationId_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var name = "Test Project";
        var defaultOrganizationId = Guid.Empty;

        // Act & Assert
        var action = () => factory(name, defaultOrganizationId);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithBothInvalidNameAndOrganization_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var emptyName = string.Empty;
        var emptyOrganizationId = Guid.Empty;

        // Act & Assert
        var action = () => factory(emptyName, emptyOrganizationId);
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
        var project = createExisting(existingProject);

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

        var invalidData = new ProjectDataStub(existingProject)
        {
            Name = string.Empty
        };

        // Act & Assert
        var action = () => createExisting(invalidData);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateExisting_WithInvalidOrganization_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<IProject.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IProject>>();
        var existingProject = await generator.CreateAsync(CancellationToken);

        var invalidData = new ProjectDataStub(existingProject)
        {
            Organization = Guid.Empty
        };

        // Act & Assert
        var action = () => createExisting(invalidData);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void Id_IsUniqueForEachNewProject()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var organizationId = Guid.NewGuid();

        // Act
        var project1 = factory("Project 1", organizationId);
        var project2 = factory("Project 2", organizationId);

        // Assert
        project1.Id.Should().NotBe(project2.Id);
    }

    [TestMethod]
    public void CreateNew_MultipleProjectsForSameOrganization_Succeeds()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var organizationId = Guid.NewGuid();

        // Act
        var project1 = factory("Project 1", organizationId);
        var project2 = factory("Project 2", organizationId);
        var project3 = factory("Project 3", organizationId);

        // Assert
        project1.Organization.Should().Be(organizationId);
        project2.Organization.Should().Be(organizationId);
        project3.Organization.Should().Be(organizationId);
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
        var longName = new string('A', 1000);
        var organizationId = Guid.NewGuid();

        // Act
        var project = factory(longName, organizationId);

        // Assert
        project.Should().NotBeNull();
        project.Name.Should().Be(longName);
    }

    [TestMethod]
    public void CreateNew_WithSpecialCharactersInName_CreatesProject()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var specialName = "Project @#$% 123 !&*()";
        var organizationId = Guid.NewGuid();

        // Act
        var project = factory(specialName, organizationId);

        // Assert
        project.Should().NotBeNull();
        project.Name.Should().Be(specialName);
    }

    [TestMethod]
    public void CreateNew_WithUnicodeCharactersInName_CreatesProject()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IProject.CreateNew>();
        var unicodeName = "项目 José Müller";
        var organizationId = Guid.NewGuid();

        // Act
        var project = factory(unicodeName, organizationId);

        // Assert
        project.Should().NotBeNull();
        project.Name.Should().Be(unicodeName);
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

    private class ProjectDataStub : IProjectData
    {
        public Guid Id { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
        public string Name { get; set; }
        public Guid Organization { get; set; }

        public ProjectDataStub(IProject project)
        {
            Id = project.Id;
            CreatedAt = project.CreatedAt;
            UpdatedAt = project.UpdatedAt;
            Name = project.Name;
            Organization = project.Organization;
        }
    }
}
