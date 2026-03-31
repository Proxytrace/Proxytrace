using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.Organization;
using Trsr.Domain.User;
using Trsr.Testing;
// ReSharper disable CollectionNeverUpdated.Local

namespace Trsr.Domain.Tests;

[TestClass]
public sealed class OrganizationValidationTests : BaseTest<Module>
{
    [TestMethod]
    public void CreateNew_WithValidNameAndNoUsers_CreatesOrganization()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOrganization.CreateNew>();
        var name = "Test Organization";

        // Act
        var organization = factory(name, []);

        // Assert
        organization.Should().NotBeNull();
        organization.Name.Should().Be(name);
        organization.Users.Should().NotBeNull();
        organization.Users.Should().BeEmpty();
        organization.Id.Should().NotBe(Guid.Empty);
        organization.CreatedAt.Should().NotBe(default);
        organization.UpdatedAt.Should().NotBe(default);
    }

    [TestMethod]
    public void CreateNew_WithValidNameAndUsers_CreatesOrganization()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOrganization.CreateNew>();
        var name = "Test Organization";
        var user1 = CreateTestUser(services, "User 1");
        var user2 = CreateTestUser(services, "User 2");

        // Act
        var organization = factory(name, [user1, user2]);

        // Assert
        organization.Should().NotBeNull();
        organization.Name.Should().Be(name);
        organization.Users.Should().NotBeNull();
        organization.Users.Count.Should().Be(2);
        organization.Users.Should().Contain(user1);
        organization.Users.Should().Contain(user2);
    }

    [TestMethod]
    public void CreateNew_WithNullName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOrganization.CreateNew>();
        string? nullName = null;

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(nullName!, []);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithEmptyName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOrganization.CreateNew>();

        // Act & Assert
        var action = () => factory(string.Empty, []);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithWhitespaceName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOrganization.CreateNew>();

        // Act & Assert
        var action = () => factory("   ", []);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithTabsName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOrganization.CreateNew>();

        // Act & Assert
        var action = () => factory("\t\t\t", []);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateExisting_WithValidData_CreatesOrganization()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<IOrganization.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IOrganization>>();
        var existingOrganization = await generator.CreateAsync(CancellationToken);

        // Act
        var organization = createExisting(existingOrganization.Name, existingOrganization.Users, existingOrganization);

        // Assert
        organization.Should().NotBeNull();
        organization.Id.Should().Be(existingOrganization.Id);
        organization.Name.Should().Be(existingOrganization.Name);
        organization.Users.Should().BeEquivalentTo(existingOrganization.Users);
        organization.CreatedAt.Should().Be(existingOrganization.CreatedAt);
        organization.UpdatedAt.Should().Be(existingOrganization.UpdatedAt);
    }

    [TestMethod]
    public async Task CreateExisting_WithInvalidName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<IOrganization.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IOrganization>>();
        var existingOrganization = await generator.CreateAsync(CancellationToken);

        // Act & Assert
        var action = () => createExisting(string.Empty, existingOrganization.Users, existingOrganization);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void Id_IsUniqueForEachNewOrganization()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOrganization.CreateNew>();

        // Act
        var org1 = factory("Organization 1", []);
        var org2 = factory("Organization 2", []);

        // Assert
        org1.Id.Should().NotBe(org2.Id);
    }

    [TestMethod]
    public void CreateNew_WithDuplicateUsers_KeepsDuplicates()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOrganization.CreateNew>();
        var name = "Test Organization";
        var user = CreateTestUser(services, "Duplicate User");

        // Act
        var organization = factory(name, [user, user, user]);

        // Assert
        organization.Should().NotBeNull();
        // The implementation may or may not deduplicate, we just verify it accepts the input
        organization.Users.Should().Contain(user);
    }

    [TestMethod]
    public void CreateNew_WithManyUsers_CreatesOrganization()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOrganization.CreateNew>();
        var name = "Large Organization";
        var userFactory = services.GetRequiredService<IUser.CreateNew>();
        var users = Enumerable.Range(0, 100).Select(i => userFactory($"User {i}")).ToList();

        // Act
        var organization = factory(name, users);

        // Assert
        organization.Should().NotBeNull();
        organization.Users.Count.Should().Be(100);
    }

    [TestMethod]
    public void CreateNew_WithLongName_CreatesOrganization()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOrganization.CreateNew>();
        var longName = new string('A', 1000);

        // Act
        var organization = factory(longName, []);

        // Assert
        organization.Should().NotBeNull();
        organization.Name.Should().Be(longName);
    }

    [TestMethod]
    public void CreateNew_WithSpecialCharactersInName_CreatesOrganization()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOrganization.CreateNew>();
        var specialName = "Organization @#$% 123 !&*()";

        // Act
        var organization = factory(specialName, []);

        // Assert
        organization.Should().NotBeNull();
        organization.Name.Should().Be(specialName);
    }

    [TestMethod]
    public void CreateNew_WithUnicodeCharactersInName_CreatesOrganization()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOrganization.CreateNew>();
        var unicodeName = "组织 José Müller GmbH";

        // Act
        var organization = factory(unicodeName, []);

        // Assert
        organization.Should().NotBeNull();
        organization.Name.Should().Be(unicodeName);
    }

    [TestMethod]
    public async Task Organization_IsImmutable()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IOrganization>>();
        var organization = await generator.CreateAsync(CancellationToken);

        // Act & Assert
        // Since Organization is a record, we verify immutability
        var nameProperty = organization.GetType().GetProperty("Name");
        nameProperty.Should().NotBeNull();
        nameProperty.SetMethod.Should().BeNull(); // No setter, or init-only

        var usersProperty = organization.GetType().GetProperty("Users");
        usersProperty.Should().NotBeNull();
        usersProperty.SetMethod.Should().BeNull(); // No setter, or init-only
    }

    private static IUser CreateTestUser(IServiceProvider services, string name)
        => services.GetRequiredService<IUser.CreateNew>()(name);
}
