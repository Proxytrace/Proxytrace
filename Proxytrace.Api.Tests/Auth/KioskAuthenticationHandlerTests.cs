using System.Security.Claims;
using System.Text.Encodings.Web;
using AwesomeAssertions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NSubstitute;
using Proxytrace.Api.Auth;
using Proxytrace.Api.Auth.Kiosk;
using Proxytrace.Domain.Kiosk;
using Proxytrace.Domain.User;

namespace Proxytrace.Api.Tests.Auth;

[TestClass]
public sealed class KioskAuthenticationHandlerTests
{
    private static async Task<(AuthenticateResult Result, HttpContext Context)> AuthenticateAsync(
        IUserRepository users, KioskOptions options)
    {
        var optionsMonitor = Substitute.For<IOptionsMonitor<AuthenticationSchemeOptions>>();
        optionsMonitor.Get(Arg.Any<string>()).Returns(new AuthenticationSchemeOptions());

        var handler = new KioskAuthenticationHandler(
            optionsMonitor, NullLoggerFactory.Instance, UrlEncoder.Default, users, options);

        var scheme = new AuthenticationScheme(
            KioskAuthenticationHandler.SchemeName,
            KioskAuthenticationHandler.SchemeName,
            typeof(KioskAuthenticationHandler));
        var httpContext = new DefaultHttpContext();

        await handler.InitializeAsync(scheme, httpContext);
        var result = await handler.AuthenticateAsync();
        return (result, httpContext);
    }

    [TestMethod]
    public async Task HandleAuthenticate_SeededDemoUser_Succeeds()
    {
        var userId = Guid.NewGuid();
        var user = Substitute.For<IUser>();
        user.Id.Returns(userId);
        user.Email.Returns("demo@proxytrace.dev");
        user.Role.Returns(UserRole.Member);

        var users = Substitute.For<IUserRepository>();
        users.FindByEmailAsync("demo@proxytrace.dev", Arg.Any<CancellationToken>()).Returns(user);

        var (result, ctx) = await AuthenticateAsync(
            users, new KioskOptions { Enabled = true, DemoUserEmail = "demo@proxytrace.dev" });

        result.Succeeded.Should().BeTrue();
        ctx.Items[CurrentUserAccessor.UserIdItemKey].Should().Be(userId);
        result.Principal?.FindFirstValue(ClaimTypes.Email).Should().Be("demo@proxytrace.dev");
        result.Principal?.FindFirstValue(ClaimTypes.Role).Should().Be(nameof(UserRole.Member));
    }

    [TestMethod]
    public async Task HandleAuthenticate_UserNotSeeded_Fails()
    {
        var users = Substitute.For<IUserRepository>();
        users.FindByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((IUser?)null);

        var (result, _) = await AuthenticateAsync(users, new KioskOptions { Enabled = true });

        result.Succeeded.Should().BeFalse();
        result.Failure.Should().NotBeNull();
    }
}
