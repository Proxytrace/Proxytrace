using Proxytrace.Domain.AuditLog;
using System.Security.Claims;
using Autofac;
using AwesomeAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Proxytrace.Api.Controllers;
using Proxytrace.Api.Dto.Projects;
using Proxytrace.Application.Auth;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.User;
using Proxytrace.Testing;

namespace Proxytrace.Api.Tests;

[TestClass]
public sealed class ProjectsControllerTests : BaseTest<Module>
{
    [TestMethod]
    public async Task Create_WithMemberIds_ReturnsDtoWithMembers()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync(CancellationToken);
        var user = await services.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);

        var result = await controller.Create(
            new CreateProjectRequest("New project", endpoint.Id, [user.Id]),
            CancellationToken);

        var actionResult = (CreatedAtActionResult)(result.Result ?? throw new InvalidOperationException("Expected non-null Result."));
        var created = actionResult.Value as ProjectDto
            ?? throw new InvalidOperationException("Expected ProjectDto value.");
        created.Members.Should().HaveCount(1);
        created.Members.Single().Id.Should().Be(user.Id);
    }

    [TestMethod]
    public async Task AddMember_PersistsAndReturnsUpdatedDto()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var (project, user) = await SeedProjectAndUserAsync(services);

        var result = await controller.AddMember(project.Id, user.Id, CancellationToken);

        var dto = result.Value ?? throw new InvalidOperationException("Expected non-null Value.");
        dto.Members.Should().ContainSingle(m => m.Id == user.Id);
    }

    [TestMethod]
    public async Task AddMember_Idempotent_NoDuplicate()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var (project, user) = await SeedProjectAndUserAsync(services);

        await controller.AddMember(project.Id, user.Id, CancellationToken);
        var second = await controller.AddMember(project.Id, user.Id, CancellationToken);

        (second.Value ?? throw new InvalidOperationException("Expected non-null Value.")).Members.Should().HaveCount(1);
    }

    [TestMethod]
    public async Task RemoveMember_PersistsAndReturnsUpdatedDto()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var (project, user) = await SeedProjectAndUserAsync(services);
        await controller.AddMember(project.Id, user.Id, CancellationToken);

        var result = await controller.RemoveMember(project.Id, user.Id, CancellationToken);

        (result.Value ?? throw new InvalidOperationException("Expected non-null Value.")).Members.Should().BeEmpty();
    }

    [TestMethod]
    public async Task AddMember_UnknownUser_ReturnsBadRequest()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var projectGenerator = services.GetRequiredService<IDomainEntityGenerator<IProject>>();
        var project = await projectGenerator.CreateAsync(CancellationToken);

        var result = await controller.AddMember(project.Id, Guid.NewGuid(), CancellationToken);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [TestMethod]
    public async Task AddMember_UnknownProject_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.AddMember(Guid.NewGuid(), Guid.NewGuid(), CancellationToken);

        result.Result.Should().BeOfType<NotFoundResult>();
    }

    [TestMethod]
    public async Task Update_RenamesProject_ButLeavesMembershipUnchanged()
    {
        // Membership is not mass-assignable through the generic update — it only changes via the
        // dedicated add/remove-member endpoints.
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var (project, userA) = await SeedProjectAndUserAsync(services);
        await controller.AddMember(project.Id, userA.Id, CancellationToken);

        var update = new UpdateProjectRequest("Renamed", project.SystemEndpoint.Id);
        var result = await controller.Update(project.Id, update, CancellationToken);

        var dto = result.Value ?? throw new InvalidOperationException("Expected non-null Value.");
        dto.Name.Should().Be("Renamed");
        dto.Members.Should().ContainSingle(m => m.Id == userA.Id);
    }

    [TestMethod]
    public async Task GetAll_AsNonAdmin_ReturnsOnlyMemberProjects()
    {
        ICurrentUserAccessor accessor = null!;
        IServiceProvider services = GetServices(builder => accessor = RegisterAccessor(builder));
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync(CancellationToken);
        var user = await services.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);
        var createNew = services.GetRequiredService<IProject.CreateNew>();
        var repo = services.GetRequiredService<IProjectRepository>();
        var mine = await repo.AddAsync(createNew("Mine", endpoint, [user]), CancellationToken);
        await repo.AddAsync(createNew("Theirs", endpoint, []), CancellationToken);
        accessor.GetCurrentUserAsync(Arg.Any<CancellationToken>()).Returns(user);

        var controller = ResolveController(services, ContextWithRoles());
        var result = await controller.GetAll(cancellationToken: CancellationToken);

        result.Items.Should().ContainSingle().Which.Id.Should().Be(mine.Id);
    }

    [TestMethod]
    public async Task GetAll_AsAdmin_ReturnsAllProjects()
    {
        IServiceProvider services = GetServices();
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync(CancellationToken);
        var createNew = services.GetRequiredService<IProject.CreateNew>();
        var repo = services.GetRequiredService<IProjectRepository>();
        await repo.AddAsync(createNew("A", endpoint, []), CancellationToken);
        await repo.AddAsync(createNew("B", endpoint, []), CancellationToken);

        var controller = ResolveController(services, ContextWithRoles(nameof(UserRole.Admin)));
        var result = await controller.GetAll(cancellationToken: CancellationToken);

        result.Items.Should().HaveCount(2);
    }

    [TestMethod]
    public async Task Get_AsNonMember_ReturnsNotFound()
    {
        ICurrentUserAccessor accessor = null!;
        IServiceProvider services = GetServices(builder => accessor = RegisterAccessor(builder));
        var outsider = await services.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);
        var project = await services.GetRequiredService<IDomainEntityGenerator<IProject>>().CreateAsync(CancellationToken);
        accessor.GetCurrentUserAsync(Arg.Any<CancellationToken>()).Returns(outsider);

        var controller = ResolveController(services, ContextWithRoles());
        var result = await controller.Get(project.Id, CancellationToken);

        result.Result.Should().BeOfType<NotFoundResult>();
    }

    [TestMethod]
    public async Task GetMembers_AsNonMember_ReturnsNotFound()
    {
        ICurrentUserAccessor accessor = null!;
        IServiceProvider services = GetServices(builder => accessor = RegisterAccessor(builder));
        var outsider = await services.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);
        var project = await services.GetRequiredService<IDomainEntityGenerator<IProject>>().CreateAsync(CancellationToken);
        accessor.GetCurrentUserAsync(Arg.Any<CancellationToken>()).Returns(outsider);

        var controller = ResolveController(services, ContextWithRoles());
        var result = await controller.GetMembers(project.Id, CancellationToken);

        result.Result.Should().BeOfType<NotFoundResult>();
    }

    [TestMethod]
    public async Task GetMembers_AsMember_ReturnsMembers()
    {
        ICurrentUserAccessor accessor = null!;
        IServiceProvider services = GetServices(builder => accessor = RegisterAccessor(builder));
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync(CancellationToken);
        var user = await services.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);
        var createNew = services.GetRequiredService<IProject.CreateNew>();
        var repo = services.GetRequiredService<IProjectRepository>();
        var project = await repo.AddAsync(createNew("Mine", endpoint, [user]), CancellationToken);
        accessor.GetCurrentUserAsync(Arg.Any<CancellationToken>()).Returns(user);

        var controller = ResolveController(services, ContextWithRoles());
        var result = await controller.GetMembers(project.Id, CancellationToken);

        result.Value.Should().ContainSingle(m => m.Id == user.Id);
    }

    [TestMethod]
    public async Task Delete_RemovesBuiltInTraceyAgent_ThenDeletesProject()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var project = await services.GetRequiredService<IDomainEntityGenerator<IProject>>().CreateAsync(CancellationToken);
        // Give the project its built-in Tracey system agent, exactly as project creation does.
        await services.GetRequiredService<Proxytrace.Application.Tracey.ITraceyAgentProvisioner>()
            .EnsureTraceyAgentAsync(project, CancellationToken);

        var result = await controller.Delete(project.Id, CancellationToken);

        result.Should().BeOfType<NoContentResult>();
        (await services.GetRequiredService<IProjectRepository>().FindAsync(project.Id, CancellationToken))
            .Should().BeNull();
    }

    [TestMethod]
    public async Task Delete_ProjectWithUserAgent_ReturnsConflict()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        // A generated agent is a normal (non-system) agent; deleting its project must be refused.
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);
        agent.IsSystemAgent.Should().BeFalse();

        var result = await controller.Delete(agent.Project.Id, CancellationToken);

        result.Should().BeOfType<ConflictObjectResult>();
        (await services.GetRequiredService<IProjectRepository>().FindAsync(agent.Project.Id, CancellationToken))
            .Should().NotBeNull();
    }

    [TestMethod]
    public async Task Delete_UnknownProject_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.Delete(Guid.NewGuid(), CancellationToken);

        result.Should().BeOfType<NotFoundResult>();
    }

    private static ProjectsController ResolveController(IServiceProvider services, ControllerContext? context = null)
    {
        var controller = new ProjectsController(
            services.GetRequiredService<IProjectRepository>(),
            services.GetRequiredService<IRepository<IModelEndpoint>>(),
            services.GetRequiredService<IRepository<IUser>>(),
            services.GetRequiredService<IAgentRepository>(),
            services.GetRequiredService<IProject.CreateNew>(),
            services.GetRequiredService<IProject.CreateExisting>(),
            services.GetRequiredService<Proxytrace.Application.Tracey.ITraceyAgentProvisioner>(),
            services.GetRequiredService<Proxytrace.Application.Evaluator.IDefaultEvaluatorProvisioner>(),
            services.GetRequiredService<ICurrentUserAccessor>(),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<Proxytrace.Domain.AuditLog.Audit>.Instance);
        if (context is not null)
            controller.ControllerContext = context;
        return controller;
    }

    private static ICurrentUserAccessor RegisterAccessor(ContainerBuilder builder)
    {
        var accessor = Substitute.For<ICurrentUserAccessor>();
        builder.RegisterInstance(accessor).As<ICurrentUserAccessor>();
        return accessor;
    }

    private static ControllerContext ContextWithRoles(params string[] roles)
    {
        var identity = new ClaimsIdentity(roles.Select(r => new Claim(ClaimTypes.Role, r)), "test");
        var http = new DefaultHttpContext { User = new ClaimsPrincipal(identity) };
        return new ControllerContext { HttpContext = http };
    }

    private async Task<(IProject project, IUser user)> SeedProjectAndUserAsync(IServiceProvider services)
    {
        var project = await services.GetRequiredService<IDomainEntityGenerator<IProject>>().CreateAsync(CancellationToken);
        var user = await services.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);
        return (project, user);
    }
}
