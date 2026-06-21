using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Proxytrace.Api.Auth;
using Proxytrace.Application.Auth;
using Proxytrace.Domain;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.User;
using Proxytrace.Testing;

namespace Proxytrace.Api.Tests;

/// <summary>
/// Unit tests for the central cross-tenant guard (#193). Admins bypass membership; everyone else is
/// confined to the projects they belong to; an unauthenticated/unknown caller gets nothing.
/// </summary>
[TestClass]
public sealed class ProjectAccessGuardTests : BaseTest<Module>
{
    [TestMethod]
    public async Task CanAccessProject_AsAdmin_AlwaysTrue()
    {
        IServiceProvider services = GetServices();
        var guard = NewGuard(services, await AdminUserAsync(services));

        (await guard.CanAccessProjectAsync(Guid.NewGuid(), CancellationToken)).Should().BeTrue();
    }

    [TestMethod]
    public async Task CanAccessProject_AsMember_TrueForOwnProject()
    {
        IServiceProvider services = GetServices();
        var member = await MemberUserAsync(services);
        var project = await ProjectWithMembersAsync(services, member);
        var guard = NewGuard(services, member);

        (await guard.CanAccessProjectAsync(project.Id, CancellationToken)).Should().BeTrue();
    }

    [TestMethod]
    public async Task CanAccessProject_AsNonMember_False()
    {
        IServiceProvider services = GetServices();
        var member = await MemberUserAsync(services);
        var otherProject = await ProjectWithMembersAsync(services); // member not added
        var guard = NewGuard(services, member);

        (await guard.CanAccessProjectAsync(otherProject.Id, CancellationToken)).Should().BeFalse();
    }

    [TestMethod]
    public async Task CanAccessProject_NoCurrentUser_False()
    {
        IServiceProvider services = GetServices();
        var guard = NewGuard(services, currentUser: null);

        (await guard.CanAccessProjectAsync(Guid.NewGuid(), CancellationToken)).Should().BeFalse();
    }

    [TestMethod]
    public async Task GetAccessibleProjectIds_AsAdmin_ReturnsNull()
    {
        IServiceProvider services = GetServices();
        var guard = NewGuard(services, await AdminUserAsync(services));

        (await guard.GetAccessibleProjectIdsAsync(CancellationToken)).Should().BeNull();
    }

    [TestMethod]
    public async Task GetAccessibleProjectIds_AsMember_ReturnsOnlyMemberProjects()
    {
        IServiceProvider services = GetServices();
        var member = await MemberUserAsync(services);
        var mine = await ProjectWithMembersAsync(services, member);
        await ProjectWithMembersAsync(services); // someone else's project
        var guard = NewGuard(services, member);

        var ids = await guard.GetAccessibleProjectIdsAsync(CancellationToken);

        ids.Should().NotBeNull();
        ids.Should().ContainSingle().Which.Should().Be(mine.Id);
    }

    [TestMethod]
    public async Task GetAccessibleProjectIds_NoCurrentUser_ReturnsEmpty()
    {
        IServiceProvider services = GetServices();
        var guard = NewGuard(services, currentUser: null);

        (await guard.GetAccessibleProjectIdsAsync(CancellationToken)).Should().BeEmpty();
    }

    private static ProjectAccessGuard NewGuard(IServiceProvider services, IUser? currentUser)
    {
        var accessor = Substitute.For<ICurrentUserAccessor>();
        accessor.GetCurrentUserAsync(Arg.Any<CancellationToken>()).Returns(currentUser);
        return new ProjectAccessGuard(accessor, services.GetRequiredService<IProjectRepository>());
    }

    private async Task<IUser> AdminUserAsync(IServiceProvider services) => await CreateUserAsync(services, UserRole.Admin);
    private async Task<IUser> MemberUserAsync(IServiceProvider services) => await CreateUserAsync(services, UserRole.Member);

    private async Task<IUser> CreateUserAsync(IServiceProvider services, UserRole role)
    {
        var create = services.GetRequiredService<IUser.CreateNew>();
        var user = create($"{Guid.NewGuid():N}@example.test", externalSubject: null, passwordHash: "hash", role);
        return await services.GetRequiredService<IRepository<IUser>>().AddAsync(user, CancellationToken);
    }

    private async Task<IProject> ProjectWithMembersAsync(IServiceProvider services, params IUser[] members)
    {
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().GetOrCreateAsync(CancellationToken);
        var createNew = services.GetRequiredService<IProject.CreateNew>();
        var project = createNew($"P-{Guid.NewGuid():N}", endpoint, members);
        return await services.GetRequiredService<IProjectRepository>().AddAsync(project, CancellationToken);
    }
}
