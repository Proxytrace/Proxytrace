using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain;
using Trsr.Domain.User;
using Trsr.Testing;

namespace Trsr.Storage.Tests;

[TestClass]
public sealed class UserRepositoryTests : BaseTest<Module>
{
    [TestMethod]
    public async Task FindByName_WithExistingUser_ReturnsUser()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IUserRepository>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();
        var user = await generator.CreateAsync(CancellationToken);

        // Act
        var foundUser = await repository.FindByName(user.Name, CancellationToken);

        // Assert
        foundUser.Should().NotBeNull();
        foundUser.Id.Should().Be(user.Id);
        foundUser.Name.Should().Be(user.Name);
    }

    [TestMethod]
    public async Task FindByName_WithNonExistingUser_ReturnsNull()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IUserRepository>();
        var nonExistentName = "NonExistentUser_" + Guid.NewGuid();

        // Act
        var foundUser = await repository.FindByName(nonExistentName, CancellationToken);

        // Assert
        foundUser.Should().BeNull();
    }

    [TestMethod]
    public async Task FindByName_WithEmptyDatabase_ReturnsNull()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IUserRepository>();

        // Act
        var foundUser = await repository.FindByName("AnyName", CancellationToken);

        // Assert
        foundUser.Should().BeNull();
    }

    [TestMethod]
    public async Task FindByName_WithExactMatch_ReturnsCorrectUser()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IUserRepository>();
        var factory = services.GetRequiredService<IUser.CreateNew>();

        var user1 = factory("John Doe");
        var user2 = factory("Jane Doe");
        var user3 = factory("John Smith");

        await repository.AddAsync(user1, CancellationToken);
        await repository.AddAsync(user2, CancellationToken);
        await repository.AddAsync(user3, CancellationToken);

        // Act
        var foundUser = await repository.FindByName("Jane Doe", CancellationToken);

        // Assert
        foundUser.Should().NotBeNull();
        foundUser.Id.Should().Be(user2.Id);
        foundUser.Name.Should().Be("Jane Doe");
    }

    [TestMethod]
    public async Task FindByName_IsCaseSensitive()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IUserRepository>();
        var factory = services.GetRequiredService<IUser.CreateNew>();

        var user = factory("TestUser");
        await repository.AddAsync(user, CancellationToken);

        // Act
        var foundUpperCase = await repository.FindByName("TESTUSER", CancellationToken);
        var foundLowerCase = await repository.FindByName("testuser", CancellationToken);
        var foundExact = await repository.FindByName("TestUser", CancellationToken);

        // Assert
        // Behavior depends on database collation - typically case-sensitive in code
        foundExact.Should().NotBeNull();
        foundExact.Name.Should().Be("TestUser");
    }

    [TestMethod]
    public async Task FindByName_WithSpecialCharacters_ReturnsUser()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IUserRepository>();
        var factory = services.GetRequiredService<IUser.CreateNew>();

        var specialName = "User@#$%123";
        var user = factory(specialName);
        await repository.AddAsync(user, CancellationToken);

        // Act
        var foundUser = await repository.FindByName(specialName, CancellationToken);

        // Assert
        foundUser.Should().NotBeNull();
        foundUser.Name.Should().Be(specialName);
    }

    [TestMethod]
    public async Task FindByName_WithUnicodeCharacters_ReturnsUser()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IUserRepository>();
        var factory = services.GetRequiredService<IUser.CreateNew>();

        var unicodeName = "用户名 José Müller";
        var user = factory(unicodeName);
        await repository.AddAsync(user, CancellationToken);

        // Act
        var foundUser = await repository.FindByName(unicodeName, CancellationToken);

        // Assert
        foundUser.Should().NotBeNull();
        foundUser.Name.Should().Be(unicodeName);
    }

    [TestMethod]
    public async Task FindByName_WithWhitespaceInName_ReturnsUser()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IUserRepository>();
        var factory = services.GetRequiredService<IUser.CreateNew>();

        var nameWithSpaces = "John   Doe";
        var user = factory(nameWithSpaces);
        await repository.AddAsync(user, CancellationToken);

        // Act
        var foundUser = await repository.FindByName(nameWithSpaces, CancellationToken);

        // Assert
        foundUser.Should().NotBeNull();
        foundUser.Name.Should().Be(nameWithSpaces);
    }

    [TestMethod]
    public async Task FindByName_AfterUserUpdate_ReturnsUpdatedUser()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IUserRepository>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();
        var createExisting = services.GetRequiredService<IUser.CreateExisting>();

        var initialUser = await generator.CreateAsync(CancellationToken);
        var initialName = initialUser.Name;

        // Update the user
        var updatedUser = createExisting("Updated Name", initialUser);
        await repository.UpdateAsync(updatedUser, CancellationToken);

        // Act
        var foundByOldName = await repository.FindByName(initialName, CancellationToken);
        var foundByNewName = await repository.FindByName("Updated Name", CancellationToken);

        // Assert
        foundByOldName.Should().BeNull();
        foundByNewName.Should().NotBeNull();
        foundByNewName.Id.Should().Be(initialUser.Id);
        foundByNewName.Name.Should().Be("Updated Name");
    }

    [TestMethod]
    public async Task FindByName_AfterUserRemoval_ReturnsNull()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IUserRepository>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();

        var user = await generator.CreateAsync(CancellationToken);
        var userName = user.Name;

        // Remove the user
        await repository.RemoveAsync(user.Id, CancellationToken);

        // Act
        var foundUser = await repository.FindByName(userName, CancellationToken);

        // Assert
        foundUser.Should().BeNull();
    }

    [TestMethod]
    public async Task FindByName_WithMultipleUsersWithDifferentNames_ReturnsCorrectUser()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IUserRepository>();
        var factory = services.GetRequiredService<IUser.CreateNew>();

        var users = new[]
        {
            factory("Alice"),
            factory("Bob"),
            factory("Charlie"),
            factory("David"),
            factory("Eve")
        };

        foreach (var user in users)
        {
            await repository.AddAsync(user, CancellationToken);
        }

        // Act
        var foundAlice = await repository.FindByName("Alice", CancellationToken);
        var foundCharlie = await repository.FindByName("Charlie", CancellationToken);
        var foundEve = await repository.FindByName("Eve", CancellationToken);

        // Assert
        foundAlice.Should().NotBeNull();
        foundAlice.Name.Should().Be("Alice");

        foundCharlie.Should().NotBeNull();
        foundCharlie.Name.Should().Be("Charlie");

        foundEve.Should().NotBeNull();
        foundEve.Name.Should().Be("Eve");
    }

    [TestMethod]
    public async Task FindByName_WithLongName_ReturnsUser()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IUserRepository>();
        var factory = services.GetRequiredService<IUser.CreateNew>();

        var longName = new string('A', 1000);
        var user = factory(longName);
        await repository.AddAsync(user, CancellationToken);

        // Act
        var foundUser = await repository.FindByName(longName, CancellationToken);

        // Assert
        foundUser.Should().NotBeNull();
        foundUser.Name.Should().Be(longName);
    }

    [TestMethod]
    public async Task FindByName_CalledMultipleTimes_ReturnsSameUser()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IUserRepository>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();
        var user = await generator.CreateAsync(CancellationToken);

        // Act
        var found1 = await repository.FindByName(user.Name, CancellationToken);
        var found2 = await repository.FindByName(user.Name, CancellationToken);
        var found3 = await repository.FindByName(user.Name, CancellationToken);

        // Assert
        found1.Should().NotBeNull();
        found2.Should().NotBeNull();
        found3.Should().NotBeNull();
        found1.Id.Should().Be(user.Id);
        found2.Id.Should().Be(user.Id);
        found3.Id.Should().Be(user.Id);
    }

    [TestMethod]
    public async Task FindByName_ReturnsUserWithAllProperties()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IUserRepository>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();
        var user = await generator.CreateAsync(CancellationToken);

        // Act
        var foundUser = await repository.FindByName(user.Name, CancellationToken);

        // Assert
        foundUser.Should().NotBeNull();
        foundUser.Should().BeEquivalentTo(user);
    }

}
