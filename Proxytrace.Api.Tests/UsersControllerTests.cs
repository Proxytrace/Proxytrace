using AwesomeAssertions;
using Autofac;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Proxytrace.Api.Controllers;
using Proxytrace.Api.Dto.Users;
using Proxytrace.Application.Auth;
using Proxytrace.Domain;
using Proxytrace.Domain.User;
using Proxytrace.Testing;

namespace Proxytrace.Api.Tests;

[TestClass]
public sealed class UsersControllerTests : BaseTest<Module>
{
    [TestMethod]
    public async Task GetAll_ReturnsSeededUsers()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var u = await services.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);

        var result = await controller.GetAll(cancellationToken: CancellationToken);

        result.Items.Should().ContainSingle(x => x.Id == u.Id);
    }

    [TestMethod]
    public async Task Me_NoCurrentUser_ReturnsUnauthorized()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Me(CancellationToken);

        result.Result.Should().BeOfType<UnauthorizedResult>();
    }

    [TestMethod]
    public async Task Me_HasCurrentUser_ReturnsDto()
    {
        IServiceProvider services = GetServices(builder =>
        {
            var stub = Substitute.For<ICurrentUserAccessor>();
            builder.RegisterInstance(stub).As<ICurrentUserAccessor>();
        });
        var user = await services.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);
        services.GetRequiredService<ICurrentUserAccessor>()
            .GetCurrentUserAsync(Arg.Any<CancellationToken>())
            .Returns(user);

        var controller = ResolveController(services);
        var result = await controller.Me(CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Id.Should().Be(user.Id);
    }

    [TestMethod]
    public async Task Get_Unknown_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Get(Guid.NewGuid(), CancellationToken);

        result.Result.Should().BeOfType<NotFoundResult>();
    }

    [TestMethod]
    public async Task UpdateRole_PersistsNewRole()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var user = await services.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);
        var target = user.Role == UserRole.Admin ? UserRole.Member : UserRole.Admin;

        var result = await controller.UpdateRole(user.Id, new UpdateUserRoleRequest(target), CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Role.Should().Be(target);
    }

    [TestMethod]
    public async Task UpdateRole_Unknown_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.UpdateRole(Guid.NewGuid(), new UpdateUserRoleRequest(UserRole.Admin), CancellationToken);

        result.Result.Should().BeOfType<NotFoundResult>();
    }

    [TestMethod]
    public async Task Delete_Existing_ReturnsNoContent()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var user = await services.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);

        var result = await controller.Delete(user.Id, CancellationToken);

        result.Should().BeOfType<NoContentResult>();
    }

    [TestMethod]
    public async Task Delete_Unknown_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Delete(Guid.NewGuid(), CancellationToken);

        result.Should().BeOfType<NotFoundResult>();
    }

    private static UsersController ResolveController(IServiceProvider services) => new(
        services.GetRequiredService<IRepository<IUser>>(),
        services.GetRequiredService<ICurrentUserAccessor>());
}
