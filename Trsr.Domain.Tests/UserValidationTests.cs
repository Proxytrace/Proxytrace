using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.User;
using Trsr.Testing;

namespace Trsr.Domain.Tests;

[TestClass]
public sealed class UserValidationTests : BaseTest<Module>
{
    [TestMethod]
    public Task CreateNew_WithValidName_CreatesUser()
    {
        try
        {
            // Arrange
            IServiceProvider services = GetServices();
            var factory = services.GetRequiredService<IUser.CreateNew>();
            var name = "John Doe";

            // Act
            var user = factory(name);

            // Assert
            user.Should().NotBeNull();
            user.Name.Should().Be(name);
            user.Id.Should().NotBe(Guid.Empty);
            user.CreatedAt.Should().NotBe(default);
            user.UpdatedAt.Should().NotBe(default);
            return Task.CompletedTask;
        }
        catch (Exception exception)
        {
            return Task.FromException(exception);
        }
    }

    [TestMethod]
    public void CreateNew_WithNullName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IUser.CreateNew>();
        string? nullName = null;

        // Act & Assert
        // ReSharper disable once NullableWarningSuppressionIsUsed
        var action = () => factory(nullName!);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithEmptyName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IUser.CreateNew>();
        var emptyName = string.Empty;

        // Act & Assert
        var action = () => factory(emptyName);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithWhitespaceName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IUser.CreateNew>();
        var whitespaceName = "   ";

        // Act & Assert
        var action = () => factory(whitespaceName);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithTabsName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IUser.CreateNew>();
        var tabsName = "\t\t\t";

        // Act & Assert
        var action = () => factory(tabsName);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithNewlinesName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IUser.CreateNew>();
        var newlinesName = "\n\r\n";

        // Act & Assert
        var action = () => factory(newlinesName);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateExisting_WithValidData_CreatesUser()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<IUser.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();
        var existingUser = await generator.CreateAsync(CancellationToken);

        // Act
        var user = createExisting(existingUser);

        // Assert
        user.Should().NotBeNull();
        user.Id.Should().Be(existingUser.Id);
        user.Name.Should().Be(existingUser.Name);
        user.CreatedAt.Should().Be(existingUser.CreatedAt);
        user.UpdatedAt.Should().Be(existingUser.UpdatedAt);
    }

    [TestMethod]
    public async Task CreateExisting_WithInvalidName_ThrowsValidationException()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<IUser.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();
        var existingUser = await generator.CreateAsync(CancellationToken);

        var invalidData = new UserDataStub(existingUser)
        {
            Name = string.Empty
        };

        // Act & Assert
        var action = () => createExisting(invalidData);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void Id_IsUniqueForEachNewUser()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IUser.CreateNew>();

        // Act
        var user1 = factory("User 1");
        var user2 = factory("User 2");

        // Assert
        user1.Id.Should().NotBe(user2.Id);
    }

    [TestMethod]
    public async Task User_IsImmutable()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();
        var user = await generator.CreateAsync(CancellationToken);

        // Act & Assert
        // Since User is a record, we can't modify properties directly
        // This test verifies that the User type doesn't have property setters
        var nameProperty = user.GetType().GetProperty("Name");
        nameProperty.Should().NotBeNull();
        nameProperty.SetMethod.Should().BeNull(); // No setter, or init-only
    }

    [TestMethod]
    public void CreateNew_WithLongName_CreatesUser()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IUser.CreateNew>();
        var longName = new string('A', 1000);

        // Act
        var user = factory(longName);

        // Assert
        user.Should().NotBeNull();
        user.Name.Should().Be(longName);
    }

    [TestMethod]
    public void CreateNew_WithSpecialCharactersInName_CreatesUser()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IUser.CreateNew>();
        var specialName = "User @#$% 123 !&*()";

        // Act
        var user = factory(specialName);

        // Assert
        user.Should().NotBeNull();
        user.Name.Should().Be(specialName);
    }

    [TestMethod]
    public void CreateNew_WithUnicodeCharactersInName_CreatesUser()
    {
        // Arrange
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IUser.CreateNew>();
        var unicodeName = "用户名 José Müller";

        // Act
        var user = factory(unicodeName);

        // Assert
        user.Should().NotBeNull();
        user.Name.Should().Be(unicodeName);
    }

    private class UserDataStub : IUserData
    {
        public Guid Id { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
        public string Name { get; set; }

        public UserDataStub(IUser user)
        {
            Id = user.Id;
            CreatedAt = user.CreatedAt;
            UpdatedAt = user.UpdatedAt;
            Name = user.Name;
        }
    }
}
