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
    private const string ValidHash = "AQAAAAEAACcQAAAAEHashValue";

    [TestMethod]
    public void CreateNew_OidcUser_CreatesUser()
    {
        var factory = GetServices().GetRequiredService<IUser.CreateNew>();
        var u = factory(ValidEmail, ValidSubject, null, UserRole.Member);
        u.Email.Should().Be(ValidEmail);
        u.ExternalSubject.Should().Be(ValidSubject);
        u.PasswordHash.Should().BeNull();
    }

    [TestMethod]
    public void CreateNew_LocalUser_CreatesUser()
    {
        var factory = GetServices().GetRequiredService<IUser.CreateNew>();
        var u = factory(ValidEmail, null, ValidHash, UserRole.Admin);
        u.ExternalSubject.Should().BeNull();
        u.PasswordHash.Should().Be(ValidHash);
    }

    [TestMethod]
    public void CreateNew_NoSubjectAndNoHash_Throws()
    {
        var factory = GetServices().GetRequiredService<IUser.CreateNew>();
        var act = () => factory(ValidEmail, null, null, UserRole.Member);
        act.Should().Throw<Exception>();
    }

    [TestMethod]
    public void CreateNew_EmptyEmail_Throws()
    {
        var factory = GetServices().GetRequiredService<IUser.CreateNew>();
        var act = () => factory(string.Empty, ValidSubject, null, UserRole.Member);
        act.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task ChangePasswordHash_UpdatesHash()
    {
        var services = GetServices();
        var gen = services.GetRequiredService<IDomainEntityGenerator<IUser>>();
        var u = await gen.CreateAsync(CancellationToken);

        var updated = await u.ChangePasswordHash("new-hash", CancellationToken);

        updated.PasswordHash.Should().Be("new-hash");
    }
}
