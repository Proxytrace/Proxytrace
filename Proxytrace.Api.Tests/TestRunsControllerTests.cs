using AwesomeAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Proxytrace.Api.Controllers;
using Proxytrace.Api.Dto.TestRuns;
using Proxytrace.Application.AuditLog;
using Proxytrace.Application.Streaming;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.TestRun;
using Proxytrace.Testing;

namespace Proxytrace.Api.Tests;

[TestClass]
public sealed class TestRunsControllerTests : BaseTest<Module>
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
    public async Task GetAll_ReturnsSeededRun()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var run = await services.GetRequiredService<IDomainEntityGenerator<ITestRun>>().CreateAsync(CancellationToken);

        var result = await controller.GetAll(cancellationToken: CancellationToken);

        result.Items.Should().ContainSingle(r => r.Id == run.Id);
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
    public async Task Get_Existing_ReturnsDto()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var run = await services.GetRequiredService<IDomainEntityGenerator<ITestRun>>().CreateAsync(CancellationToken);

        var result = await controller.Get(run.Id, CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Id.Should().Be(run.Id);
    }

    [TestMethod]
    public async Task GetCaseFixture_UnknownRun_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);

        var result = await controller.GetCaseFixture(Guid.NewGuid(), Guid.NewGuid(), CancellationToken);

        result.Result.Should().BeOfType<NotFoundResult>();
    }

    [TestMethod]
    public async Task GetCaseFixture_UnknownCase_ReturnsNotFound()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var run = await services.GetRequiredService<IDomainEntityGenerator<ITestRun>>().CreateAsync(CancellationToken);

        var result = await controller.GetCaseFixture(run.Id, Guid.NewGuid(), CancellationToken);

        result.Result.Should().BeOfType<NotFoundResult>();
    }

    [TestMethod]
    public async Task Delete_Existing_ReturnsNoContent()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var run = await services.GetRequiredService<IDomainEntityGenerator<ITestRun>>().CreateAsync(CancellationToken);

        var result = await controller.Delete(run.Id, CancellationToken);

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
    public async Task GetAll_FilterByAgent_ScopesResults()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var gen = services.GetRequiredService<IDomainEntityGenerator<ITestRun>>();
        var runA = await gen.CreateAsync(CancellationToken);
        await gen.CreateAsync(CancellationToken);
        var agentId = runA.Group.Suite.Agent.Id;

        var result = await controller.GetAll(agentId: agentId, cancellationToken: CancellationToken);

        result.Items.Should().OnlyContain(r => r.AgentId == agentId);
    }

    [TestMethod]
    public async Task GetAll_Pagination_RespectsPageSize()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        var gen = services.GetRequiredService<IDomainEntityGenerator<ITestRun>>();
        await gen.CreateAsync(CancellationToken);
        await gen.CreateAsync(CancellationToken);
        await gen.CreateAsync(CancellationToken);

        var firstPage = await controller.GetAll(page: 1, pageSize: 2, cancellationToken: CancellationToken);
        var secondPage = await controller.GetAll(page: 2, pageSize: 2, cancellationToken: CancellationToken);

        firstPage.Items.Should().HaveCount(2);
        firstPage.Total.Should().Be(3);
        secondPage.Items.Should().HaveCount(1);
        secondPage.Items.Select(i => i.Id).Should().NotIntersectWith(firstPage.Items.Select(i => i.Id));
    }

    [TestMethod]
    public async Task Stream_UnknownRun_Returns404()
    {
        IServiceProvider services = GetServices();
        var controller = ResolveController(services);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext(),
        };

        await controller.Stream(Guid.NewGuid(), CancellationToken);

        controller.Response.StatusCode.Should().Be(404);
    }

    private static TestRunsController ResolveController(IServiceProvider services) => new(
        services.GetRequiredService<ITestRunRepository>(),
        services.GetRequiredService<IAgentRepository>(),
        services.GetRequiredService<ITestResultBroadcaster>(),
        services.GetRequiredService<TestRunDtoMapper>(),
        services.GetRequiredService<Proxytrace.Api.Auth.IProjectAccessGuard>(),
        NullLogger<Audit>.Instance);
}
