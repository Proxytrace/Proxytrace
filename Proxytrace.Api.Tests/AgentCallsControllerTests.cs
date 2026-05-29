using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
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

    private static AgentCallsController ResolveController(IServiceProvider services) => new(
        services.GetRequiredService<IAgentCallRepository>(),
        services.GetRequiredService<IAgentRepository>(),
        services.GetRequiredService<IDashboardStatistics>(),
        services.GetRequiredService<ITraceBroadcaster>(),
        services.GetRequiredService<AgentCallDtoMapper>(),
        services.GetRequiredService<AgentDtoMapper>());
}
