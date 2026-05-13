using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Application.Auth.Local;
using Trsr.Domain.User;
using Trsr.Testing;

namespace Trsr.Application.Tests.Auth.Local;

[TestClass]
public sealed class LoginServiceTests : BaseTest<Module>
{
    [TestMethod]
    public async Task Login_WithCorrectPassword_ReturnsToken()
    {
        var s = GetServices();
        var pwd = s.GetRequiredService<IPasswordService>();
        var factory = s.GetRequiredService<IUser.CreateNew>();
        var draft = factory("u@b.com", null, "x", UserRole.Member);
        var hash = pwd.Hash(draft, "Abcdef1!");
        var withHash = factory("u@b.com", null, hash, UserRole.Member);
        await withHash.AddAsync(CancellationToken);

        var svc = s.GetRequiredService<ILoginService>();
        var result = await svc.LoginAsync("u@b.com", "Abcdef1!", CancellationToken);

        result.Should().NotBeNull();
        result.Token.Should().NotBeNullOrEmpty();
    }

    [TestMethod]
    public async Task Login_WithWrongPassword_ReturnsNull()
    {
        var s = GetServices();
        var pwd = s.GetRequiredService<IPasswordService>();
        var factory = s.GetRequiredService<IUser.CreateNew>();
        var draft = factory("w@b.com", null, "x", UserRole.Member);
        var hash = pwd.Hash(draft, "Abcdef1!");
        var withHash = factory("w@b.com", null, hash, UserRole.Member);
        await withHash.AddAsync(CancellationToken);

        var svc = s.GetRequiredService<ILoginService>();
        (await svc.LoginAsync("w@b.com", "Wrong!1A", CancellationToken)).Should().BeNull();
    }

    [TestMethod]
    public async Task Login_WithUnknownEmail_ReturnsNull()
    {
        var svc = GetServices().GetRequiredService<ILoginService>();
        (await svc.LoginAsync("unknown@b.com", "Abcdef1!", CancellationToken)).Should().BeNull();
    }
}
