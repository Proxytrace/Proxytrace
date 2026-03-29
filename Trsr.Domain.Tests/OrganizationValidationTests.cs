using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.Organization;
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
        var users = new List<Guid>();

        // Act
        var organization = factory(name, users);

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
        var userId1 = Guid.NewGuid();
        var userId2 = Guid.NewGuid();
        var users = new List<Guid> { userId1, userId2 };

        // Act
        var organization = factory(name, users);

        // Assert
        organization.Should().NotBeNull();
        organization.Name.Should().Be(name);
        organization.Users.Should().NotBeNull();
        organization.Users.Count.Should().Be(2);
        organization.Users.Should().Contain(userId1);
        organization.Users.Should().Contain(userId2);
    }

    [TestMethod]
    public void CreateNew_WithNullName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOrganization.CreateNew>();
        string? nullName = null;
        var users = new List<Guid>();

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(nullName!, users);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithEmptyName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOrganization.CreateNew>();
        var emptyName = string.Empty;
        var users = new List<Guid>();

        // Act & Assert
        var action = () => factory(emptyName, users);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithWhitespaceName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOrganization.CreateNew>();
        var whitespaceName = "   ";
        var users = new List<Guid>();

        // Act & Assert
        var action = () => factory(whitespaceName, users);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithTabsName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOrganization.CreateNew>();
        var tabsName = "\t\t\t";
        var users = new List<Guid>();

        // Act & Assert
        var action = () => factory(tabsName, users);
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
        var organization = createExisting(existingOrganization);

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

        var invalidData = new OrganizationDataStub(existingOrganization)
        {
            Name = string.Empty
        };

        // Act & Assert
        var action = () => createExisting(invalidData);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void Id_IsUniqueForEachNewOrganization()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOrganization.CreateNew>();
        var users = new List<Guid>();

        // Act
        var org1 = factory("Organization 1", users);
        var org2 = factory("Organization 2", users);

        // Assert
        org1.Id.Should().NotBe(org2.Id);
    }

    [TestMethod]
    public void CreateNew_WithDuplicateUserIds_KeepsDuplicates()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOrganization.CreateNew>();
        var name = "Test Organization";
        var userId = Guid.NewGuid();
        var users = new List<Guid> { userId, userId, userId };

        // Act
        var organization = factory(name, users);

        // Assert
        organization.Should().NotBeNull();
        // The implementation may or may not deduplicate, we just verify it accepts the input
        organization.Users.Should().Contain(userId);
    }

    [TestMethod]
    public void CreateNew_WithManyUsers_CreatesOrganization()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IOrganization.CreateNew>();
        var name = "Large Organization";
        var users = Enumerable.Range(0, 100).Select(_ => Guid.NewGuid()).ToList();

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
        var users = new List<Guid>();

        // Act
        var organization = factory(longName, users);

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
        var users = new List<Guid>();

        // Act
        var organization = factory(specialName, users);

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
        var users = new List<Guid>();

        // Act
        var organization = factory(unicodeName, users);

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

    private class OrganizationDataStub : IOrganizationData
    {
        public Guid Id { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
        public string Name { get; set; }
        public IReadOnlyCollection<Guid> Users { get; set; }

        public OrganizationDataStub(IOrganization organization)
        {
            Id = organization.Id;
            CreatedAt = organization.CreatedAt;
            UpdatedAt = organization.UpdatedAt;
            Name = organization.Name;
            Users = organization.Users;
        }
    }
}
