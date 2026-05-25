using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Application.Setup;
using Proxytrace.Domain;
using Proxytrace.Domain.User;
using Proxytrace.Testing;

namespace Proxytrace.Application.Tests.Setup;

[TestClass]
public sealed class SetupFirstAdminTests : BaseTest<Module>
{
    [TestMethod]
    public async Task CreateFirstAdmin_FromEmptyDb_CreatesAdmin()
    {
        var s = GetServices();
        var svc = s.GetRequiredService<ISetupService>();
        var users = s.GetRequiredService<IUserRepository>();

        var result = await svc.CreateFirstAdminAsync("admin@proxytrace.local", "Abcdef1!", CancellationToken);

        result.UserId.Should().NotBe(Guid.Empty);
        result.Token.Should().NotBeNullOrEmpty();
        var user = await users.FindByEmailAsync("admin@proxytrace.local", CancellationToken);
        user.Should().NotBeNull();
        user.Role.Should().Be(UserRole.Admin);
    }

    [TestMethod]
    public async Task CreateFirstAdmin_WhenUsersExist_Throws()
    {
        var s = GetServices();
        await s.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);

        var svc = s.GetRequiredService<ISetupService>();
        await FluentActions
            .Invoking(() => svc.CreateFirstAdminAsync("a@b.com", "Abcdef1!", CancellationToken))
            .Should().ThrowAsync<InvalidOperationException>();
    }
}
