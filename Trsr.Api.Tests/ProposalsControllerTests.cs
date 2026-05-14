using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Api.Controllers;
using Trsr.Api.Dto.Proposals;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.Proposal;
using Trsr.Testing;

namespace Trsr.Api.Tests;

[TestClass]
public sealed class ProposalsControllerTests : BaseTest<Module>
{
    [TestMethod]
    public async Task GetAll_NoProposals_ReturnsEmpty()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.GetAll(cancellationToken: CancellationToken);

        result.Should().BeEmpty();
    }

    [TestMethod]
    public async Task UpdateStatus_Unknown_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.UpdateStatus(
            Guid.NewGuid(),
            new UpdateProposalStatusRequest(ProposalStatus.Accepted),
            CancellationToken);

        result.Result.Should().BeOfType<NotFoundResult>();
    }

    [TestMethod]
    public async Task GetAll_FilteredByUnknownAgent_ReturnsEmpty()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.GetAll(agentId: Guid.NewGuid(), cancellationToken: CancellationToken);

        result.Should().BeEmpty();
    }

    [TestMethod]
    public async Task GetAll_FilteredByUnknownProject_ReturnsEmpty()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.GetAll(projectId: Guid.NewGuid(), cancellationToken: CancellationToken);

        result.Should().BeEmpty();
    }

    [TestMethod]
    public async Task UpdateStatus_OnAgent_PersistsStatusChange()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);
        var newEndpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().CreateAsync(CancellationToken);
        var abRun = await services.GetRequiredService<IDomainEntityGenerator<Domain.TestRun.ITestRun>>().CreateAsync(CancellationToken);
        var factory = services.GetRequiredService<IModelSwitchProposal.CreateNew>();
        var repo = services.GetRequiredService<IOptimizationProposalRepository>();
        var proposal = factory(agent, Priority.Medium, "r", newEndpoint, 0.1, null, null, [], abRun);
        proposal = (IModelSwitchProposal)await repo.AddAsync(proposal, CancellationToken);

        var target = proposal.Status == ProposalStatus.Accepted ? ProposalStatus.Rejected : ProposalStatus.Accepted;
        await controller.UpdateStatus(proposal.Id, new UpdateProposalStatusRequest(target), CancellationToken);

        var reloaded = await repo.GetAsync(proposal.Id, CancellationToken);
        reloaded.Status.Should().Be(target);
    }

    private static ProposalsController ResolveController(IServiceProvider services) => new(
        services.GetRequiredService<IOptimizationProposalRepository>(),
        services.GetRequiredService<IModelSwitchProposal.CreateExisting>(),
        services.GetRequiredService<ISystemPromptProposal.CreateExisting>(),
        services.GetRequiredService<IToolUpdateProposal.CreateExisting>());
}
