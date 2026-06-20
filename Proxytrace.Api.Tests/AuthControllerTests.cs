using AwesomeAssertions;
using Autofac;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Proxytrace.Api.Controllers;
using Proxytrace.Api.Dto.Auth;
using Proxytrace.Application.Auth;
using Proxytrace.Application.Auth.Local;
using Proxytrace.Application.Setup;
using Proxytrace.Domain;
using Proxytrace.Domain.Invite;
using Proxytrace.Domain.User;
using Proxytrace.Testing;

namespace Proxytrace.Api.Tests;

[TestClass]
public sealed class AuthControllerTests : BaseTest<Module>
{
    [TestMethod]
    public async Task GetMode_NoUsers_ReportsSetupRequired()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var mode = await controller.GetMode(CancellationToken);

        mode.Mode.Should().Be("local");
        mode.SetupRequired.Should().BeTrue();
    }

    [TestMethod]
    public async Task GetMode_WithUser_NoSetupRequired()
    {
        IServiceProvider services = GetServices();
        await services.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);
        var controller = ResolveController(services);

        var mode = await controller.GetMode(CancellationToken);

        mode.SetupRequired.Should().BeFalse();
    }

    [TestMethod]
    public async Task Login_BadCreds_ReturnsUnauthorized()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Login(new LoginRequest("nobody@example.com", "wrongpassword"), CancellationToken);

        result.Result.Should().BeOfType<UnauthorizedResult>();
    }

    [TestMethod]
    public async Task Setup_WeakPassword_ReturnsBadRequest()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Setup(new SetupAdminRequest("admin@example.com", "a"), CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task Setup_AfterUsersExist_ReturnsConflict()
    {
        IServiceProvider services = GetServices();
        await services.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);
        var controller = ResolveController(services);

        var result = await controller.Setup(new SetupAdminRequest("admin@example.com", "StrongPass1!Foo"), CancellationToken);

        result.Result.Should().BeOfType<ConflictObjectResult>();
    }

    [TestMethod]
    public async Task ClaimLegacy_WeakPassword_ReturnsBadRequest()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.ClaimLegacy(new ClaimLegacyRequest("x@y.com", "1"), CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task Preview_UnknownToken_ReturnsGone()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Preview("nonsense", CancellationToken);

        var status = (StatusCodeResult)(result.Result ?? throw new InvalidOperationException());
        status.StatusCode.Should().Be(410);
    }

    [TestMethod]
    public async Task Signup_WeakPassword_ReturnsBadRequest()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Signup(new SignupRequest("anything", "1"), CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task Signup_BadToken_ReturnsGone()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Signup(new SignupRequest("does-not-exist", "StrongPass1!Foo"), CancellationToken);

        var status = (ObjectResult)(result.Result ?? throw new InvalidOperationException());
        status.StatusCode.Should().Be(410);
    }

    [TestMethod]
    public async Task Setup_ValidRequest_SetsHttpOnlySessionCookie()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Setup(new SetupAdminRequest("admin@example.com", "StrongPass1!Foo"), CancellationToken);

        result.Value.Should().NotBeNull();
        var setCookie = controller.Response.Headers.SetCookie.ToString();
        setCookie.Should().Contain("proxytrace_session=");
        setCookie.ToLowerInvariant().Should().Contain("httponly").And.Contain("samesite=strict");
    }

    [TestMethod]
    public async Task Login_ValidCreds_SetsSessionCookieWithToken()
    {
        IServiceProvider services = GetServices();
        var setupController = ResolveController(services);
        await setupController.Setup(new SetupAdminRequest("admin@example.com", "StrongPass1!Foo"), CancellationToken);

        var controller = ResolveController(services);
        var result = await controller.Login(new LoginRequest("admin@example.com", "StrongPass1!Foo"), CancellationToken);

        result.Value.Should().NotBeNull();
        var setCookie = controller.Response.Headers.SetCookie.ToString();
        setCookie.Should().Contain($"proxytrace_session={result.Value.Token}");
    }

    [TestMethod]
    public async Task Login_BadCreds_SetsNoCookie()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        await controller.Login(new LoginRequest("nobody@example.com", "wrongpassword"), CancellationToken);

        controller.Response.Headers.SetCookie.ToString().Should().BeEmpty();
    }

    [TestMethod]
    public void Logout_ClearsSessionCookie()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = controller.Logout();

        result.Should().BeOfType<NoContentResult>();
        var setCookie = controller.Response.Headers.SetCookie.ToString();
        setCookie.Should().Contain("proxytrace_session=;");
    }

    [TestMethod]
    public async Task Me_WithoutAuthenticatedUser_ReturnsUnauthorized()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Me(CancellationToken);

        result.Result.Should().BeOfType<UnauthorizedResult>();
    }

    [TestMethod]
    public async Task Me_WithAuthenticatedUser_IncludesLanguage()
    {
        var accessor = Substitute.For<ICurrentUserAccessor>();
        IServiceProvider services = GetServices(builder => builder.RegisterInstance(accessor).As<ICurrentUserAccessor>());
        var create = services.GetRequiredService<IUser.CreateNew>();
        var user = create($"{Guid.NewGuid():N}@example.test", externalSubject: null, passwordHash: "hash", UserRole.Member, "de");
        await services.GetRequiredService<IRepository<IUser>>().AddAsync(user, CancellationToken);
        accessor.GetCurrentUserAsync(Arg.Any<CancellationToken>()).Returns(user);

        var result = await ResolveController(services).Me(CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Language.Should().Be("de");
    }

    private static AuthController ResolveController(IServiceProvider services) => new(
        new AuthOptions(),
        services.GetRequiredService<ISetupService>(),
        services.GetRequiredService<ILoginService>(),
        services.GetRequiredService<ILegacyClaimService>(),
        services.GetRequiredService<IInviteService>(),
        services.GetRequiredService<IInviteRepository>(),
        services.GetRequiredService<IPasswordPolicy>(),
        services.GetRequiredService<ICurrentUserAccessor>(),
        services.GetRequiredService<IStreamTicketService>(),
        new ConfigurationBuilder().Build(),
        Microsoft.Extensions.Logging.Abstractions.NullLogger<Proxytrace.Application.AuditLog.Audit>.Instance)
    {
        ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
    };
}
