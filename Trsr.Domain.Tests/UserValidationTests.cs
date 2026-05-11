using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain.User;
using Trsr.Testing;

namespace Trsr.Domain.Tests;

[TestClass]
public sealed class UserValidationTests : BaseTest<Module>
{
    private const string ValidEmail = "user@example.com";
    private const string ValidSubject = "issuer|sub-123";

    [TestMethod]
    public Task CreateNew_WithValidName_CreatesUser()
    {
        try
        {
            IServiceProvider services = GetServices();
            var factory = services.GetRequiredService<IUser.CreateNew>();
            var name = "John Doe";

            var user = factory(name, ValidEmail, ValidSubject, UserRole.Member);

            user.Should().NotBeNull();
            user.Name.Should().Be(name);
            user.Email.Should().Be(ValidEmail);
            user.ExternalSubject.Should().Be(ValidSubject);
            user.Role.Should().Be(UserRole.Member);
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
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IUser.CreateNew>();

        var action = () => factory(null!, ValidEmail, ValidSubject, UserRole.Member);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithEmptyName_ThrowsValidationException()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IUser.CreateNew>();

        var action = () => factory(string.Empty, ValidEmail, ValidSubject, UserRole.Member);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithWhitespaceName_ThrowsValidationException()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IUser.CreateNew>();

        var action = () => factory("   ", ValidEmail, ValidSubject, UserRole.Member);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithTabsName_ThrowsValidationException()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IUser.CreateNew>();

        var action = () => factory("\t\t\t", ValidEmail, ValidSubject, UserRole.Member);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithNewlinesName_ThrowsValidationException()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IUser.CreateNew>();

        var action = () => factory("\n\r\n", ValidEmail, ValidSubject, UserRole.Member);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithEmptyEmail_ThrowsValidationException()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IUser.CreateNew>();

        var action = () => factory("John", string.Empty, ValidSubject, UserRole.Member);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_WithEmptyExternalSubject_ThrowsValidationException()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IUser.CreateNew>();

        var action = () => factory("John", ValidEmail, string.Empty, UserRole.Member);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateExisting_WithValidData_CreatesUser()
    {
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<IUser.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();
        var existingUser = await generator.CreateAsync(CancellationToken);

        var user = createExisting(
            existingUser.Name,
            existingUser.Email,
            existingUser.ExternalSubject,
            existingUser.Role,
            existingUser);

        user.Should().NotBeNull();
        user.Id.Should().Be(existingUser.Id);
        user.Name.Should().Be(existingUser.Name);
        user.Email.Should().Be(existingUser.Email);
        user.ExternalSubject.Should().Be(existingUser.ExternalSubject);
        user.Role.Should().Be(existingUser.Role);
        user.CreatedAt.Should().Be(existingUser.CreatedAt);
        user.UpdatedAt.Should().Be(existingUser.UpdatedAt);
    }

    [TestMethod]
    public async Task CreateExisting_WithInvalidName_ThrowsValidationException()
    {
        IServiceProvider services = GetServices();
        var createExisting = services.GetRequiredService<IUser.CreateExisting>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();
        var existingUser = await generator.CreateAsync(CancellationToken);

        var action = () => createExisting(
            string.Empty,
            existingUser.Email,
            existingUser.ExternalSubject,
            existingUser.Role,
            existingUser);
        action.Should().Throw<Exception>();
    }

    [TestMethod]
    public void Id_IsUniqueForEachNewUser()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IUser.CreateNew>();

        var user1 = factory("User 1", "u1@example.com", "iss|s1", UserRole.Member);
        var user2 = factory("User 2", "u2@example.com", "iss|s2", UserRole.Member);

        user1.Id.Should().NotBe(user2.Id);
    }

    [TestMethod]
    public async Task User_IsImmutable()
    {
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();
        var user = await generator.CreateAsync(CancellationToken);

        var nameProperty = user.GetType().GetProperty("Name");
        nameProperty.Should().NotBeNull();
        nameProperty!.SetMethod.Should().BeNull();
    }

    [TestMethod]
    public void CreateNew_WithLongName_CreatesUser()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IUser.CreateNew>();
        var longName = new string('A', 1000);

        var user = factory(longName, ValidEmail, ValidSubject, UserRole.Member);

        user.Should().NotBeNull();
        user.Name.Should().Be(longName);
    }

    [TestMethod]
    public void CreateNew_WithSpecialCharactersInName_CreatesUser()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IUser.CreateNew>();
        var specialName = "User @#$% 123 !&*()";

        var user = factory(specialName, ValidEmail, ValidSubject, UserRole.Member);

        user.Should().NotBeNull();
        user.Name.Should().Be(specialName);
    }

    [TestMethod]
    public void CreateNew_WithUnicodeCharactersInName_CreatesUser()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<IUser.CreateNew>();
        var unicodeName = "用户名 José Müller";

        var user = factory(unicodeName, ValidEmail, ValidSubject, UserRole.Member);

        user.Should().NotBeNull();
        user.Name.Should().Be(unicodeName);
    }
}
