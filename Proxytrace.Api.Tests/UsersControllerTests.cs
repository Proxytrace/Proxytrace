using AwesomeAssertions;
using Autofac;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Proxytrace.Api.Controllers;
using Proxytrace.Api.Dto.Users;
using Proxytrace.Application.Auth;
using Proxytrace.Domain;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.Project;
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
        ICurrentUserAccessor accessor = null!;
        IServiceProvider services = GetServices(builder => accessor = RegisterAccessor(builder));
        var user = await services.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);
        accessor.GetCurrentUserAsync(Arg.Any<CancellationToken>()).Returns(user);

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
    public async Task UpdateRole_AsAdmin_PromotesTarget_PersistsNewRole()
    {
        ICurrentUserAccessor accessor = null!;
        IServiceProvider services = GetServices(builder => accessor = RegisterAccessor(builder));
        var acting = await CreateUserAsync(services, UserRole.Admin);
        accessor.GetCurrentUserAsync(Arg.Any<CancellationToken>()).Returns(acting);
        var target = await CreateUserAsync(services, UserRole.Member);
        var controller = ResolveController(services);

        var result = await controller.UpdateRole(target.Id, new UpdateUserRoleRequest(UserRole.Admin), CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Role.Should().Be(UserRole.Admin);
    }

    [TestMethod]
    public async Task UpdateRole_NoCurrentUser_ReturnsUnauthorized()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.UpdateRole(Guid.NewGuid(), new UpdateUserRoleRequest(UserRole.Admin), CancellationToken);

        result.Result.Should().BeOfType<UnauthorizedResult>();
    }

    [TestMethod]
    public async Task UpdateRole_Unknown_ReturnsNotFound()
    {
        ICurrentUserAccessor accessor = null!;
        IServiceProvider services = GetServices(builder => accessor = RegisterAccessor(builder));
        var acting = await CreateUserAsync(services, UserRole.Admin);
        accessor.GetCurrentUserAsync(Arg.Any<CancellationToken>()).Returns(acting);
        var controller = ResolveController(services);

        var result = await controller.UpdateRole(Guid.NewGuid(), new UpdateUserRoleRequest(UserRole.Member), CancellationToken);

        result.Result.Should().BeOfType<NotFoundResult>();
    }

    [TestMethod]
    public async Task Delete_AsAdmin_RemovesTarget_ReturnsNoContent()
    {
        ICurrentUserAccessor accessor = null!;
        IServiceProvider services = GetServices(builder => accessor = RegisterAccessor(builder));
        var acting = await CreateUserAsync(services, UserRole.Admin);
        accessor.GetCurrentUserAsync(Arg.Any<CancellationToken>()).Returns(acting);
        var target = await CreateUserAsync(services, UserRole.Member);
        var controller = ResolveController(services);

        var result = await controller.Delete(target.Id, CancellationToken);

        result.Should().BeOfType<NoContentResult>();
    }

    [TestMethod]
    public async Task Delete_NoCurrentUser_ReturnsUnauthorized()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Delete(Guid.NewGuid(), CancellationToken);

        result.Should().BeOfType<UnauthorizedResult>();
    }

    [TestMethod]
    public async Task Delete_Unknown_ReturnsNotFound()
    {
        ICurrentUserAccessor accessor = null!;
        IServiceProvider services = GetServices(builder => accessor = RegisterAccessor(builder));
        var acting = await CreateUserAsync(services, UserRole.Admin);
        accessor.GetCurrentUserAsync(Arg.Any<CancellationToken>()).Returns(acting);
        var controller = ResolveController(services);

        var result = await controller.Delete(Guid.NewGuid(), CancellationToken);

        result.Should().BeOfType<NotFoundResult>();
    }

    [TestMethod]
    public async Task GetProjects_ReturnsProjectsTheUserBelongsTo()
    {
        IServiceProvider services = GetServices();
        var user = await CreateUserAsync(services, UserRole.Member);
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync(CancellationToken);
        var createProject = services.GetRequiredService<IProject.CreateNew>();
        var project = createProject("Assigned project", endpoint, [user]);
        await services.GetRequiredService<IRepository<IProject>>().AddAsync(project, CancellationToken);
        var controller = ResolveController(services);

        var result = await controller.GetProjects(user.Id, CancellationToken);

        result.Value.Should().ContainSingle().Which.Id.Should().Be(project.Id);
    }

    [TestMethod]
    public async Task GetProjects_UnknownUser_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.GetProjects(Guid.NewGuid(), CancellationToken);

        result.Result.Should().BeOfType<NotFoundResult>();
    }

    private static ICurrentUserAccessor RegisterAccessor(ContainerBuilder builder)
    {
        var accessor = Substitute.For<ICurrentUserAccessor>();
        builder.RegisterInstance(accessor).As<ICurrentUserAccessor>();
        return accessor;
    }

    private async Task<IUser> CreateUserAsync(IServiceProvider services, UserRole role)
    {
        var create = services.GetRequiredService<IUser.CreateNew>();
        var user = create($"{Guid.NewGuid():N}@example.test", externalSubject: null, passwordHash: "hash", role);
        return await services.GetRequiredService<IRepository<IUser>>().AddAsync(user, CancellationToken);
    }

    private static UsersController ResolveController(IServiceProvider services) => new(
        services.GetRequiredService<IRepository<IUser>>(),
        services.GetRequiredService<IProjectRepository>(),
        services.GetRequiredService<IUserAdministrationService>(),
        services.GetRequiredService<ICurrentUserAccessor>());
}
