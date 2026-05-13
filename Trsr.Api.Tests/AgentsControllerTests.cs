using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Api.Controllers;
using Trsr.Api.Dto.Agents;
using Trsr.Application.Streaming;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentCall;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Testing;

namespace Trsr.Api.Tests;

[TestClass]
public sealed class AgentsControllerTests : BaseTest<Module>
{
    [TestMethod]
    public async Task GetAll_NoAgents_ReturnsEmptyPage()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.GetAll(cancellationToken: CancellationToken);

        result.Items.Should().BeEmpty();
        result.Total.Should().Be(0);
    }

    [TestMethod]
    public async Task GetAll_FiltersByProjectId()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var agentGen = services.GetRequiredService<IDomainEntityGenerator<IAgent>>();
        var projectGen = services.GetRequiredService<IDomainEntityGenerator<IProject>>();
        var agentFactory = services.GetRequiredService<IAgent.CreateNew>();
        var agentRepo = services.GetRequiredService<IAgentRepository>();

        var seedA = await agentGen.CreateAsync(CancellationToken);
        var projectB = await projectGen.CreateAsync(CancellationToken);
        var agentB = await agentRepo.AddAsync(
            agentFactory(seedA.Name + "-b", seedA.SystemPrompt, seedA.Tools, seedA.Endpoint, projectB, seedA.ModelParameters, false),
            CancellationToken);

        var result = await controller.GetAll(projectId: seedA.Project.Id, cancellationToken: CancellationToken);

        result.Items.Should().ContainSingle(a => a.Id == seedA.Id);
        result.Items.Should().NotContain(a => a.Id == agentB.Id);
    }

    [TestMethod]
    public async Task Get_UnknownId_ReturnsNotFound()
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
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);

        var result = await controller.Get(agent.Id, CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Id.Should().Be(agent.Id);
    }

    [TestMethod]
    public async Task Delete_Existing_ReturnsNoContent()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);

        var result = await controller.Delete(agent.Id, CancellationToken);

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

    [TestMethod]
    public async Task UpdateEndpoint_SwapsEndpoint()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);
        var newEndpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().CreateAsync(CancellationToken);

        var result = await controller.UpdateEndpoint(agent.Id, new UpdateAgentEndpointRequest(newEndpoint.Id), CancellationToken);

        result.Should().BeOfType<NoContentResult>();
        var reloaded = await services.GetRequiredService<IAgentRepository>().GetAsync(agent.Id, CancellationToken);
        reloaded.Endpoint.Id.Should().Be(newEndpoint.Id);
    }

    private static AgentsController ResolveController(IServiceProvider services) => new(
        services.GetRequiredService<IAgentRepository>(),
        services.GetRequiredService<IRepository<IModelEndpoint>>(),
        services.GetRequiredService<IAgentCallRepository>(),
        services.GetRequiredService<IProposalBroadcaster>());
}
