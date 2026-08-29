using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Application.Auth.Local;
using Proxytrace.Domain;
using Proxytrace.Domain.User;
using Nordstein.Core.Testing;

namespace Proxytrace.Application.Tests.Auth.Local;

[TestClass]
public sealed class InviteServiceTests : BaseTest<Module>
{
    [TestMethod]
    public async Task Create_PersistsInviteWithToken()
    {
        var s = GetServices();
        var inviter = await s.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);
        var svc = s.GetRequiredService<IInviteService>();

        var created = await svc.CreateAsync("a@b.com", UserRole.Member, inviter, CancellationToken);

        created.RawToken.Should().NotBeNullOrEmpty();
        // Only the hash is persisted — never the raw token.
        created.Invite.TokenHash.Should().NotBe(created.RawToken);
        created.Invite.Email.Should().Be("a@b.com");
        created.Invite.ConsumedAt.Should().BeNull();
        created.Invite.ExpiresAt.Should().BeAfter(DateTimeOffset.UtcNow.AddDays(6));
    }

    [TestMethod]
    public async Task GetByToken_ReturnsInviteWhenValid()
    {
        var s = GetServices();
        var inviter = await s.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);
        var svc = s.GetRequiredService<IInviteService>();
        var created = await svc.CreateAsync("a@b.com", UserRole.Member, inviter, CancellationToken);

        var fetched = await svc.GetByTokenAsync(created.RawToken, CancellationToken);
        fetched.Should().NotBeNull();
        fetched.Email.Should().Be("a@b.com");
    }

    [TestMethod]
    public async Task Consume_CreatesUserAndMarksConsumed()
    {
        var s = GetServices();
        var inviter = await s.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);
        var svc = s.GetRequiredService<IInviteService>();
        var created = await svc.CreateAsync("new@b.com", UserRole.Admin, inviter, CancellationToken);

        var newUser = await svc.ConsumeAsync(created.RawToken, "Abcdef1!", CancellationToken);

        newUser.Should().NotBeNull();
        newUser.Email.Should().Be("new@b.com");
        newUser.Role.Should().Be(UserRole.Admin);
        newUser.PasswordHash.Should().NotBeNullOrEmpty();

        (await svc.GetByTokenAsync(created.RawToken, CancellationToken)).Should().BeNull();
    }
}
