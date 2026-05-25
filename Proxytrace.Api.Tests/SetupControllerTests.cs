using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Api.Controllers;
using Proxytrace.Application.Cleanup;
using Proxytrace.Application.Setup;
using Proxytrace.Domain;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.User;
using Proxytrace.Testing;

namespace Proxytrace.Api.Tests;

[TestClass]
public sealed class SetupControllerTests : BaseTest<Module>
{
    private static SetupController CreateController(IServiceProvider services) => new(
        services.GetRequiredService<IRepository<IUser>>(),
        services.GetRequiredService<IRepository<IProject>>(),
        services.GetRequiredService<IDataCleanupService>(),
        services.GetRequiredService<ISetupService>());

    [TestMethod]
    public async Task GetStatus_WhenNoUsersOrProjectsExist_ReturnsNotConfigured()
    {
        IServiceProvider services = GetServices();
        var controller = CreateController(services);

        var result = await controller.GetStatus(CancellationToken);

        result.IsConfigured.Should().BeFalse();
    }

    [TestMethod]
    public async Task GetStatus_WhenUserButNoProject_ReturnsNotConfigured()
    {
        IServiceProvider services = GetServices();
        await services.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);

        var controller = CreateController(services);

        var result = await controller.GetStatus(CancellationToken);

        result.IsConfigured.Should().BeFalse();
    }

    [TestMethod]
    public async Task GetStatus_WhenUserAndProjectExist_ReturnsConfigured()
    {
        IServiceProvider services = GetServices();
        await services.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);
        await services.GetRequiredService<IDomainEntityGenerator<IProject>>().CreateAsync(CancellationToken);

        var controller = CreateController(services);

        var result = await controller.GetStatus(CancellationToken);

        result.IsConfigured.Should().BeTrue();
    }
}
