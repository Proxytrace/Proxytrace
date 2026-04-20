using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.Organization;
using Trsr.Domain.Project;
using Trsr.Domain.User;
using Trsr.Storage;
using Trsr.Testing;

namespace Trsr.Domain.Tests;

[TestClass]
public sealed class DomainEntityGeneratorTests : BaseTest<Module>
{
    protected override void ConfigureContainer(ContainerBuilder builder)
    {
        base.ConfigureContainer(builder);
        builder.RegisterModule(new Storage.Module(StorageConfiguration.InMemory()));
    }

    // User Generator Tests

    [TestMethod]
    public async Task UserGenerator_GenerateAsync_CreatesValidUser()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();

        // Act
        var user = await generator.CreateAsync(CancellationToken);

        // Assert
        user.Should().NotBeNull();
        user.Id.Should().NotBe(Guid.Empty);
        user.Name.Should().NotBeNullOrWhiteSpace();
        user.CreatedAt.Should().NotBe(default);
        user.UpdatedAt.Should().NotBe(default);
    }

    [TestMethod]
    public async Task UserGenerator_CreateAsync_CreatesAndPersistsUser()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();
        var repository = services.GetRequiredService<IRepository<IUser>>();

        // Act
        var user = await generator.CreateAsync(CancellationToken);

        // Assert
        user.Should().NotBeNull();
        user.Id.Should().NotBe(Guid.Empty);

        // Verify it was persisted
        var retrieved = await repository.GetAsync(user.Id, CancellationToken);
        retrieved.Should().NotBeNull();
        retrieved.Id.Should().Be(user.Id);
        retrieved.Name.Should().Be(user.Name);
    }

    [TestMethod]
    public async Task UserGenerator_GetOrCreateAsync_CreatesNewUserFirstTime()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();
        var repository = services.GetRequiredService<IRepository<IUser>>();
        var initialCount = await repository.CountAsync(CancellationToken);

        // Act
        var user = await generator.GetOrCreateAsync(CancellationToken);

        // Assert
        user.Should().NotBeNull();
        var finalCount = await repository.CountAsync(CancellationToken);
        finalCount.Should().Be(initialCount + 1);
    }

    [TestMethod]
    public async Task UserGenerator_GetOrCreateAsync_ReusesSameUserOnSecondCall()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();

        // Act
        var user1 = await generator.GetOrCreateAsync(CancellationToken);
        var user2 = await generator.GetOrCreateAsync(CancellationToken);

        // Assert
        user1.Id.Should().Be(user2.Id);
    }

    [TestMethod]
    public async Task UserGenerator_MultipleGenerateAsync_CreatesUniqueUsers()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();

        // Act
        var user1 = await generator.CreateAsync(CancellationToken);
        var user2 = await generator.CreateAsync(CancellationToken);
        var user3 = await generator.CreateAsync(CancellationToken);

        // Assert
        user1.Id.Should().NotBe(user2.Id);
        user2.Id.Should().NotBe(user3.Id);
        user1.Id.Should().NotBe(user3.Id);
        user1.Name.Should().NotBe(user2.Name);
        user2.Name.Should().NotBe(user3.Name);
    }

    // Organization Generator Tests

    [TestMethod]
    public async Task OrganizationGenerator_GenerateAsync_CreatesValidOrganization()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IOrganization>>();

        // Act
        var organization = await generator.CreateAsync(CancellationToken);

        // Assert
        organization.Should().NotBeNull();
        organization.Id.Should().NotBe(Guid.Empty);
        organization.Name.Should().NotBeNullOrWhiteSpace();
        organization.Users.Should().NotBeNull();
        organization.CreatedAt.Should().NotBe(default);
        organization.UpdatedAt.Should().NotBe(default);
    }

    [TestMethod]
    public async Task OrganizationGenerator_CreateAsync_CreatesAndPersistsOrganization()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IOrganization>>();
        var repository = services.GetRequiredService<IRepository<IOrganization>>();

        // Act
        var organization = await generator.CreateAsync(CancellationToken);

        // Assert
        organization.Should().NotBeNull();
        organization.Id.Should().NotBe(Guid.Empty);

        // Verify it was persisted
        var retrieved = await repository.GetAsync(organization.Id, CancellationToken);
        retrieved.Should().NotBeNull();
        retrieved.Id.Should().Be(organization.Id);
        retrieved.Name.Should().Be(organization.Name);
    }

    [TestMethod]
    public async Task OrganizationGenerator_GetOrCreateAsync_CreatesNewOrganizationFirstTime()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IOrganization>>();
        var repository = services.GetRequiredService<IRepository<IOrganization>>();
        var initialCount = await repository.CountAsync(CancellationToken);

        // Act
        var organization = await generator.GetOrCreateAsync(CancellationToken);

        // Assert
        organization.Should().NotBeNull();
        var finalCount = await repository.CountAsync(CancellationToken);
        finalCount.Should().Be(initialCount + 1);
    }

    [TestMethod]
    public async Task OrganizationGenerator_GetOrCreateAsync_ReusesSameOrganizationOnSecondCall()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IOrganization>>();

        // Act
        var org1 = await generator.GetOrCreateAsync(CancellationToken);
        var org2 = await generator.GetOrCreateAsync(CancellationToken);

        // Assert
        org1.Id.Should().Be(org2.Id);
    }

    [TestMethod]
    public async Task OrganizationGenerator_MultipleGenerateAsync_CreatesUniqueOrganizations()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IOrganization>>();

        // Act
        var org1 = await generator.CreateAsync(CancellationToken);
        var org2 = await generator.CreateAsync(CancellationToken);
        var org3 = await generator.CreateAsync(CancellationToken);

        // Assert
        org1.Id.Should().NotBe(org2.Id);
        org2.Id.Should().NotBe(org3.Id);
        org1.Id.Should().NotBe(org3.Id);
        org1.Name.Should().NotBe(org2.Name);
        org2.Name.Should().NotBe(org3.Name);
    }

    // Project Generator Tests

    [TestMethod]
    public async Task ProjectGenerator_GenerateAsync_CreatesValidProject()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IProject>>();

        // Act
        var project = await generator.CreateAsync(CancellationToken);

        // Assert
        project.Should().NotBeNull();
        project.Id.Should().NotBe(Guid.Empty);
        project.Name.Should().NotBeNullOrWhiteSpace();
        project.Organization.Should().NotBe(Guid.Empty);
        project.CreatedAt.Should().NotBe(default);
        project.UpdatedAt.Should().NotBe(default);
    }

    [TestMethod]
    public async Task ProjectGenerator_CreateAsync_CreatesAndPersistsProject()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IProject>>();
        var repository = services.GetRequiredService<IRepository<IProject>>();

        // Act
        var project = await generator.CreateAsync(CancellationToken);

        // Assert
        project.Should().NotBeNull();
        project.Id.Should().NotBe(Guid.Empty);

        // Verify it was persisted
        var retrieved = await repository.GetAsync(project.Id, CancellationToken);
        retrieved.Should().NotBeNull();
        retrieved.Id.Should().Be(project.Id);
        retrieved.Name.Should().Be(project.Name);
        retrieved.Organization.Should().Be(project.Organization);
    }

    [TestMethod]
    public async Task ProjectGenerator_GetOrCreateAsync_CreatesNewProjectFirstTime()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IProject>>();
        var repository = services.GetRequiredService<IRepository<IProject>>();
        var initialCount = await repository.CountAsync(CancellationToken);

        // Act
        var project = await generator.GetOrCreateAsync(CancellationToken);

        // Assert
        project.Should().NotBeNull();
        var finalCount = await repository.CountAsync(CancellationToken);
        finalCount.Should().Be(initialCount + 1);
    }

    [TestMethod]
    public async Task ProjectGenerator_GetOrCreateAsync_ReusesSameProjectOnSecondCall()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IProject>>();

        // Act
        var project1 = await generator.GetOrCreateAsync(CancellationToken);
        var project2 = await generator.GetOrCreateAsync(CancellationToken);

        // Assert
        project1.Id.Should().Be(project2.Id);
    }

    [TestMethod]
    public async Task ProjectGenerator_MultipleGenerateAsync_CreatesUniqueProjects()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IProject>>();

        // Act
        var project1 = await generator.CreateAsync(CancellationToken);
        var project2 = await generator.CreateAsync(CancellationToken);
        var project3 = await generator.CreateAsync(CancellationToken);

        // Assert
        project1.Id.Should().NotBe(project2.Id);
        project2.Id.Should().NotBe(project3.Id);
        project1.Id.Should().NotBe(project3.Id);
        project1.Name.Should().NotBe(project2.Name);
        project2.Name.Should().NotBe(project3.Name);
    }
}
