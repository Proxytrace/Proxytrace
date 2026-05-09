using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Api.Controllers;
using Trsr.Api.Dto.Projects;
using Trsr.Domain;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Domain.User;
using Trsr.Testing;

namespace Trsr.Api.Tests;

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
            new CreateProjectRequest("New project", endpoint.Id, new[] { user.Id }),
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
    public async Task Update_ReplacingMembers_PersistsNewSet()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var (project, userA) = await SeedProjectAndUserAsync(services);
        var userB = await services.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);

        await controller.AddMember(project.Id, userA.Id, CancellationToken);

        var update = new UpdateProjectRequest(project.Name, project.SystemEndpoint.Id, new[] { userB.Id });
        var result = await controller.Update(project.Id, update, CancellationToken);

        (result.Value ?? throw new InvalidOperationException("Expected non-null Value.")).Members.Should().ContainSingle(m => m.Id == userB.Id);
    }

    private static ProjectsController ResolveController(IServiceProvider services) =>
        new(
            services.GetRequiredService<IProjectRepository>(),
            services.GetRequiredService<IRepository<IModelEndpoint>>(),
            services.GetRequiredService<IRepository<IUser>>(),
            services.GetRequiredService<IProject.CreateNew>(),
            services.GetRequiredService<IProject.CreateExisting>());

    private async Task<(IProject project, IUser user)> SeedProjectAndUserAsync(IServiceProvider services)
    {
        var project = await services.GetRequiredService<IDomainEntityGenerator<IProject>>().CreateAsync(CancellationToken);
        var user = await services.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);
        return (project, user);
    }
}
