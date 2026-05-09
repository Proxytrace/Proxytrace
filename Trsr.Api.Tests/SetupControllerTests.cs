using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Api.Controllers;
using Trsr.Application.Cleanup;
using Trsr.Domain;
using Trsr.Domain.User;
using Trsr.Testing;

namespace Trsr.Api.Tests;

[TestClass]
public sealed class SetupControllerTests : BaseTest<Module>
{
    [TestMethod]
    public async Task GetStatus_WhenNoUsersExist_ReturnsNotConfigured()
    {
        IServiceProvider services = GetServices();
        var controller = new SetupController(services.GetRequiredService<IRepository<IUser>>(), services.GetRequiredService<IDataCleanupService>());

        var result = await controller.GetStatus(CancellationToken);

        result.IsConfigured.Should().BeFalse();
    }

    [TestMethod]
    public async Task GetStatus_AfterUserCreated_ReturnsConfigured()
    {
        IServiceProvider services = GetServices();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();
        await generator.CreateAsync(CancellationToken);

        var controller = new SetupController(services.GetRequiredService<IRepository<IUser>>(), services.GetRequiredService<IDataCleanupService>());

        var result = await controller.GetStatus(CancellationToken);

        result.IsConfigured.Should().BeTrue();
    }
}
