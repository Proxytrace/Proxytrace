using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain;
using Trsr.Domain.Organization;
using Trsr.Domain.User;
using Trsr.Testing;

namespace Trsr.Storage.Tests;

[TestClass]
public sealed class OrganizationRepositoryTests : BaseTest<Module>
{
    [TestMethod]
    public async Task AddAsync_WithUsers_PersistsOrganizationAndUsers()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var orgRepository = services.GetRequiredService<IRepository<IOrganization>>();
        var userGenerator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();
        var orgFactory = services.GetRequiredService<IOrganization.CreateNew>();

        var user1 = await userGenerator.CreateAsync(CancellationToken);
        var user2 = await userGenerator.CreateAsync(CancellationToken);
        var users = new[] { user1, user2 };

        var organization = orgFactory("Test Organization", users);

        // Act
        var addedOrg = await orgRepository.AddAsync(organization, CancellationToken);

        // Assert
        addedOrg.Should().NotBeNull();
        addedOrg.Name.Should().Be("Test Organization");
        addedOrg.Users.Should().NotBeEmpty();
        addedOrg.Users.Count.Should().Be(2);
        addedOrg.Users.Should().Contain(u => u.Id == user1.Id);
        addedOrg.Users.Should().Contain(u => u.Id == user2.Id);
    }

    [TestMethod]
    public async Task GetAsync_WithUsers_LoadsOrganizationWithUsers()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var orgRepository = services.GetRequiredService<IRepository<IOrganization>>();
        var userGenerator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();
        var orgFactory = services.GetRequiredService<IOrganization.CreateNew>();

        var user1 = await userGenerator.CreateAsync(CancellationToken);
        var user2 = await userGenerator.CreateAsync(CancellationToken);
        var users = new[] { user1, user2 };

        var organization = orgFactory("Test Organization", users);
        await orgRepository.AddAsync(organization, CancellationToken);

        // Act
        var retrievedOrg = await orgRepository.GetAsync(organization.Id, CancellationToken);

        // Assert
        retrievedOrg.Should().NotBeNull();
        retrievedOrg.Id.Should().Be(organization.Id);
        retrievedOrg.Name.Should().Be("Test Organization");
        retrievedOrg.Users.Should().NotBeEmpty();
        retrievedOrg.Users.Count.Should().Be(2);
        retrievedOrg.Users.Should().Contain(u => u.Id == user1.Id);
        retrievedOrg.Users.Should().Contain(u => u.Id == user2.Id);
    }

    [TestMethod]
    public async Task UpdateAsync_AddingUsers_UpdatesRelationship()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var orgRepository = services.GetRequiredService<IRepository<IOrganization>>();
        var userGenerator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();
        var orgFactory = services.GetRequiredService<IOrganization.CreateNew>();

        var user1 = await userGenerator.CreateAsync(CancellationToken);
        var organization = orgFactory("Test Organization", [user1]);
        var addedOrg = await orgRepository.AddAsync(organization, CancellationToken);

        // Create a new user and add it to the organization
        var user2 = await userGenerator.CreateAsync(CancellationToken);
        var updatedOrg = orgFactory("Test Organization", [user1, user2]);
        
        // We need to use the existing organization's data (Id, CreatedAt, UpdatedAt)
        var existingFactory = services.GetRequiredService<IOrganization.CreateExisting>();
        var orgToUpdate = existingFactory(
            updatedOrg.Name,
            [user1, user2],
            addedOrg);

        // Act
        var result = await orgRepository.UpdateAsync(orgToUpdate, CancellationToken);

        // Assert
        result.Should().NotBeNull();
        result.Users.Count.Should().Be(2);
        result.Users.Should().Contain(u => u.Id == user1.Id);
        result.Users.Should().Contain(u => u.Id == user2.Id);

        // Verify by retrieving again
        var retrieved = await orgRepository.GetAsync(result.Id, CancellationToken);
        retrieved.Users.Count.Should().Be(2);
        retrieved.Users.Should().Contain(u => u.Id == user1.Id);
        retrieved.Users.Should().Contain(u => u.Id == user2.Id);
    }

    [TestMethod]
    public async Task UpdateAsync_RemovingUsers_UpdatesRelationship()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var orgRepository = services.GetRequiredService<IRepository<IOrganization>>();
        var userGenerator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();
        var orgFactory = services.GetRequiredService<IOrganization.CreateNew>();

        var user1 = await userGenerator.CreateAsync(CancellationToken);
        var user2 = await userGenerator.CreateAsync(CancellationToken);
        var organization = orgFactory("Test Organization", [user1, user2]);
        var addedOrg = await orgRepository.AddAsync(organization, CancellationToken);

        // Remove one user
        var existingFactory = services.GetRequiredService<IOrganization.CreateExisting>();
        var orgToUpdate = existingFactory(
            addedOrg.Name,
            [user1],
            addedOrg);

        // Act
        var result = await orgRepository.UpdateAsync(orgToUpdate, CancellationToken);

        // Assert
        result.Should().NotBeNull();
        result.Users.Count.Should().Be(1);
        result.Users.Should().Contain(u => u.Id == user1.Id);
        result.Users.Should().NotContain(u => u.Id == user2.Id);

        // Verify by retrieving again
        var retrieved = await orgRepository.GetAsync(result.Id, CancellationToken);
        retrieved.Users.Count.Should().Be(1);
        retrieved.Users.Should().Contain(u => u.Id == user1.Id);
    }

    [TestMethod]
    public async Task UpdateAsync_ClearingAllUsers_RemovesAllRelationships()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var orgRepository = services.GetRequiredService<IRepository<IOrganization>>();
        var userGenerator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();
        var orgFactory = services.GetRequiredService<IOrganization.CreateNew>();

        var user1 = await userGenerator.CreateAsync(CancellationToken);
        var user2 = await userGenerator.CreateAsync(CancellationToken);
        var organization = orgFactory("Test Organization", [user1, user2]);
        var addedOrg = await orgRepository.AddAsync(organization, CancellationToken);

        // Remove all users
        var existingFactory = services.GetRequiredService<IOrganization.CreateExisting>();
        var orgToUpdate = existingFactory(
            addedOrg.Name,
            [],
            addedOrg);

        // Act
        var result = await orgRepository.UpdateAsync(orgToUpdate, CancellationToken);

        // Assert
        result.Should().NotBeNull();
        result.Users.Should().BeEmpty();

        // Verify by retrieving again
        var retrieved = await orgRepository.GetAsync(result.Id, CancellationToken);
        retrieved.Users.Should().BeEmpty();
    }

    [TestMethod]
    public async Task AddAsync_WithoutUsers_CreatesEmptyOrganization()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var orgRepository = services.GetRequiredService<IRepository<IOrganization>>();
        var orgFactory = services.GetRequiredService<IOrganization.CreateNew>();

        var organization = orgFactory("Empty Organization", []);

        // Act
        var addedOrg = await orgRepository.AddAsync(organization, CancellationToken);

        // Assert
        addedOrg.Should().NotBeNull();
        addedOrg.Name.Should().Be("Empty Organization");
        addedOrg.Users.Should().BeEmpty();

        // Verify by retrieving
        var retrieved = await orgRepository.GetAsync(addedOrg.Id, CancellationToken);
        retrieved.Users.Should().BeEmpty();
    }

    [TestMethod]
    public async Task FindByNameAsync_WithExistingOrganization_ReturnsOrganizationWithUsers()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var orgRepository = services.GetRequiredService<IOrganizationRepository>();
        var userGenerator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();
        var orgFactory = services.GetRequiredService<IOrganization.CreateNew>();

        var user = await userGenerator.CreateAsync(CancellationToken);
        var organization = orgFactory("FindMe Organization", [user]);
        await orgRepository.AddAsync(organization, CancellationToken);

        // Act
        var found = await orgRepository.FindByNameAsync("FindMe Organization", CancellationToken);

        // Assert
        found.Should().NotBeNull();
        found.Id.Should().Be(organization.Id);
        found.Users.Count.Should().Be(1);
        found.Users.Should().Contain(u => u.Id == user.Id);
    }

    [TestMethod]
    public async Task FindByNameAsync_WithNonExistingOrganization_ReturnsNull()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var orgRepository = services.GetRequiredService<IOrganizationRepository>();

        // Act
        var found = await orgRepository.FindByNameAsync("NonExistent Organization", CancellationToken);

        // Assert
        found.Should().BeNull();
    }
}

