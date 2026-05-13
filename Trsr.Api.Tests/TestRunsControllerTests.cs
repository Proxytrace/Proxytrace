using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Api.Controllers;
using Trsr.Application.Streaming;
using Trsr.Domain;
using Trsr.Domain.TestRun;
using Trsr.Testing;

namespace Trsr.Api.Tests;

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
        result.Value!.Id.Should().Be(run.Id);
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

    private static TestRunsController ResolveController(IServiceProvider services) => new(
        services.GetRequiredService<ITestRunRepository>(),
        services.GetRequiredService<ITestResultBroadcaster>());
}
