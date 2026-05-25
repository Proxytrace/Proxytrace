using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Api.Controllers;
using Proxytrace.Api.Dto.Proposals;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.Proposal;
using Proxytrace.Testing;

namespace Proxytrace.Api.Tests;

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
        var proposal = factory(agent, Priority.Medium, "r", newEndpoint, 0.6, 0.7, null, null, [], abRun);
        proposal = (IModelSwitchProposal)await repo.AddAsync(proposal, CancellationToken);

        var target = proposal.Status == ProposalStatus.Accepted ? ProposalStatus.Rejected : ProposalStatus.Accepted;
        await controller.UpdateStatus(proposal.Id, new UpdateProposalStatusRequest(target), CancellationToken);

        var reloaded = await repo.GetAsync(proposal.Id, CancellationToken);
        reloaded.Status.Should().Be(target);
    }

    [TestMethod]
    public async Task GetAll_ModelSwitch_ExposesPassRatesAtTopLevel()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);
        var endpoint = await services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>().CreateAsync(CancellationToken);
        var abRun = await services.GetRequiredService<IDomainEntityGenerator<Domain.TestRun.ITestRun>>().CreateAsync(CancellationToken);
        var factory = services.GetRequiredService<IModelSwitchProposal.CreateNew>();
        var repo = services.GetRequiredService<IOptimizationProposalRepository>();
        var proposal = factory(agent, Priority.Medium, "r", endpoint, 0.40, 0.75, null, null, [], abRun);
        await repo.AddAsync(proposal, CancellationToken);

        var result = await controller.GetAll(agentId: agent.Id, cancellationToken: CancellationToken);

        var dto = result.Should().ContainSingle().Subject;
        dto.CurrentPassRate.Should().Be(0.40);
        dto.ProposedPassRate.Should().Be(0.75);
        dto.ExpectedPassRateDelta.Should().BeApproximately(0.35, 1e-9);
    }

    [TestMethod]
    public async Task GetAll_SystemPrompt_ExposesPassRatesAtTopLevel()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);
        var abRun = await services.GetRequiredService<IDomainEntityGenerator<Domain.TestRun.ITestRun>>().CreateAsync(CancellationToken);
        var factory = services.GetRequiredService<ISystemPromptProposal.CreateNew>();
        var repo = services.GetRequiredService<IOptimizationProposalRepository>();
        var proposal = factory(agent, Priority.Medium, "r", "new prompt", 0.50, 0.67, [], abRun);
        await repo.AddAsync(proposal, CancellationToken);

        var result = await controller.GetAll(agentId: agent.Id, cancellationToken: CancellationToken);

        var dto = result.Should().ContainSingle().Subject;
        dto.CurrentPassRate.Should().Be(0.50);
        dto.ProposedPassRate.Should().Be(0.67);
        dto.ExpectedPassRateDelta.Should().BeApproximately(0.17, 1e-9);
    }

    [TestMethod]
    public async Task GetAll_ToolUpdate_ExposesPassRatesAtTopLevel()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);
        var abRun = await services.GetRequiredService<IDomainEntityGenerator<Domain.TestRun.ITestRun>>().CreateAsync(CancellationToken);
        var factory = services.GetRequiredService<IToolUpdateProposal.CreateNew>();
        var repo = services.GetRequiredService<IOptimizationProposalRepository>();
        var proposal = factory(agent, Priority.High, "r", [], 0.33, 0.81, [], abRun);
        await repo.AddAsync(proposal, CancellationToken);

        var result = await controller.GetAll(agentId: agent.Id, cancellationToken: CancellationToken);

        var dto = result.Should().ContainSingle().Subject;
        dto.CurrentPassRate.Should().Be(0.33);
        dto.ProposedPassRate.Should().Be(0.81);
        dto.ExpectedPassRateDelta.Should().BeApproximately(0.48, 1e-9);
    }

    [TestMethod]
    public async Task GetAll_NullPassRates_ExposeNullDelta()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);
        var abRun = await services.GetRequiredService<IDomainEntityGenerator<Domain.TestRun.ITestRun>>().CreateAsync(CancellationToken);
        var factory = services.GetRequiredService<ISystemPromptProposal.CreateNew>();
        var repo = services.GetRequiredService<IOptimizationProposalRepository>();
        var proposal = factory(agent, Priority.Medium, "r", "msg", null, null, [], abRun);
        await repo.AddAsync(proposal, CancellationToken);

        var result = await controller.GetAll(agentId: agent.Id, cancellationToken: CancellationToken);

        var dto = result.Should().ContainSingle().Subject;
        dto.CurrentPassRate.Should().BeNull();
        dto.ProposedPassRate.Should().BeNull();
        dto.ExpectedPassRateDelta.Should().BeNull();
    }

    [TestMethod]
    public async Task UpdateStatus_PreservesPassRatesAcrossTransition()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var agent = await services.GetRequiredService<IDomainEntityGenerator<IAgent>>().CreateAsync(CancellationToken);
        var abRun = await services.GetRequiredService<IDomainEntityGenerator<Domain.TestRun.ITestRun>>().CreateAsync(CancellationToken);
        var factory = services.GetRequiredService<ISystemPromptProposal.CreateNew>();
        var repo = services.GetRequiredService<IOptimizationProposalRepository>();
        var proposal = factory(agent, Priority.Medium, "r", "msg", 0.5, 0.8, [], abRun);
        await repo.AddAsync(proposal, CancellationToken);

        await controller.UpdateStatus(proposal.Id, new UpdateProposalStatusRequest(ProposalStatus.Accepted), CancellationToken);

        var reloaded = await repo.GetAsync(proposal.Id, CancellationToken);
        reloaded.Status.Should().Be(ProposalStatus.Accepted);
        reloaded.CurrentPassRate.Should().Be(0.5);
        reloaded.ProposedPassRate.Should().Be(0.8);
    }

    private static ProposalsController ResolveController(IServiceProvider services) => new(
        services.GetRequiredService<IOptimizationProposalRepository>(),
        services.GetRequiredService<IModelSwitchProposal.CreateExisting>(),
        services.GetRequiredService<ISystemPromptProposal.CreateExisting>(),
        services.GetRequiredService<IToolUpdateProposal.CreateExisting>());
}
