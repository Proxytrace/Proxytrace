using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Api.Auth;
using Trsr.Api.Controllers;
using Trsr.Api.Dto.Auth;
using Trsr.Application.Auth;
using Trsr.Application.Auth.Local;
using Trsr.Application.Setup;
using Trsr.Domain;
using Trsr.Domain.Invite;
using Trsr.Domain.User;
using Trsr.Testing;

namespace Trsr.Api.Tests;

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

    private static AuthController ResolveController(IServiceProvider services) => new(
        new AuthOptions(),
        services.GetRequiredService<ISetupService>(),
        services.GetRequiredService<ILoginService>(),
        services.GetRequiredService<ILegacyClaimService>(),
        services.GetRequiredService<IInviteService>(),
        services.GetRequiredService<IInviteRepository>(),
        services.GetRequiredService<IPasswordPolicy>(),
        services.GetRequiredService<ICurrentUserAccessor>(),
        new ConfigurationBuilder().Build());
}
