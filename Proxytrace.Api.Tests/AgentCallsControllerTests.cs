using Proxytrace.Domain.Statistics;
using Proxytrace.Domain.AuditLog;
using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Proxytrace.Api.Controllers;
using Proxytrace.Api.Dto.AgentCalls;
using Proxytrace.Api.Dto.Agents;
using Proxytrace.Application.Statistics;
using Proxytrace.Application.Streaming;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Testing;

namespace Proxytrace.Api.Tests;

[TestClass]
public sealed class AgentCallsControllerTests : BaseTest<Module>
{
    [TestMethod]
    public async Task GetAll_Empty_ReturnsEmptyPage()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.GetAll(cancellationToken: CancellationToken);

        result.Items.Should().BeEmpty();
        result.Total.Should().Be(0);
    }

    [TestMethod]
    public async Task GetAll_ReturnsSeededCall()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var call = await services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>().CreateAsync(CancellationToken);

        var result = await controller.GetAll(cancellationToken: CancellationToken);

        result.Items.Should().ContainSingle(c => c.Id == call.Id);
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
    public async Task Get_ExistingId_ReturnsDto()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var call = await services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>().CreateAsync(CancellationToken);

        var result = await controller.Get(call.Id, CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Id.Should().Be(call.Id);
    }

    [TestMethod]
    public async Task Delete_Existing_ReturnsNoContent()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var call = await services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>().CreateAsync(CancellationToken);

        var result = await controller.Delete(call.Id, CancellationToken);

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

    // ── cross-tenant authorization (#193) ─────────────────────────────────────

    [TestMethod]
    public async Task Get_WhenCallerCannotAccessProject_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var call = await services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>().CreateAsync(CancellationToken);
        var controller = ResolveController(services, DenyingGuard());

        var result = await controller.Get(call.Id, CancellationToken);

        // Existing trace, but the guard denies → hidden behind a 404 (no request/response disclosed).
        result.Result.Should().BeOfType<NotFoundResult>();
    }

    [TestMethod]
    public async Task Delete_WhenCallerCannotAccessProject_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var call = await services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>().CreateAsync(CancellationToken);
        var controller = ResolveController(services, DenyingGuard());

        var result = await controller.Delete(call.Id, CancellationToken);

        result.Should().BeOfType<NotFoundResult>();
        // And it must not have been removed.
        (await services.GetRequiredService<IAgentCallRepository>().FindAsync(call.Id, CancellationToken))
            .Should().NotBeNull();
    }

    [TestMethod]
    public async Task GetAll_AsNonAdminWithoutAccessibleProjectFilter_ReturnsEmpty()
    {
        IServiceProvider services = GetServices();
        await services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>().CreateAsync(CancellationToken);
        var controller = ResolveController(services, DenyingGuard());

        // No projectId filter + a non-admin scope → no cross-tenant rows leak.
        var result = await controller.GetAll(cancellationToken: CancellationToken);

        result.Items.Should().BeEmpty();
    }

    // A non-admin who is a member of nothing: every project is inaccessible, scope set is empty.
    private static Proxytrace.Api.Auth.IProjectAccessGuard DenyingGuard()
    {
        var guard = Substitute.For<Proxytrace.Api.Auth.IProjectAccessGuard>();
        guard.CanAccessProjectAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(false);
        guard.GetAccessibleProjectIdsAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyCollection<Guid>?>([]));
        return guard;
    }

    private static AgentCallsController ResolveController(IServiceProvider services)
        => ResolveController(services, services.GetRequiredService<Proxytrace.Api.Auth.IProjectAccessGuard>());

    private static AgentCallsController ResolveController(
        IServiceProvider services, Proxytrace.Api.Auth.IProjectAccessGuard guard) => new(
        services.GetRequiredService<IAgentCallRepository>(),
        services.GetRequiredService<IAgentRepository>(),
        services.GetRequiredService<IDashboardStatistics>(),
        services.GetRequiredService<ITraceBroadcaster>(),
        services.GetRequiredService<AgentCallDtoMapper>(),
        services.GetRequiredService<AgentDtoMapper>(),
        services.GetRequiredService<Proxytrace.Domain.AgentCall.IAgentCall.CreateNew>(),
        services.GetRequiredService<Proxytrace.Domain.Completion.ICompletion.Create>(),
        guard,
        NullLogger<Audit>.Instance);
}
