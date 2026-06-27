using AwesomeAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Proxytrace.Api.Controllers;
using Proxytrace.Api.Dto.Setup;
using Proxytrace.Application.AuditLog;
using Proxytrace.Application.Cleanup;
using Proxytrace.Application.Setup;
using Proxytrace.Domain;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.User;
using Proxytrace.Testing;

namespace Proxytrace.Api.Tests;

[TestClass]
public sealed class SetupControllerTests : BaseTest<Module>
{
    private static SetupController CreateController(
        IServiceProvider services,
        bool isDevelopment = false,
        ISetupService? setup = null) => new(
        services.GetRequiredService<IRepository<IUser>>(),
        services.GetRequiredService<IRepository<IProject>>(),
        services.GetRequiredService<IDataCleanupService>(),
        setup ?? services.GetRequiredService<ISetupService>(),
        NullLogger<Audit>.Instance,
        NullLogger<SetupController>.Instance,
        Env(isDevelopment));

    private static IWebHostEnvironment Env(bool isDevelopment)
    {
        var env = Substitute.For<IWebHostEnvironment>();
        env.EnvironmentName.Returns(isDevelopment ? "Development" : "Production");
        return env;
    }

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

    [TestMethod]
    public async Task TestConnection_WhenSetupThrows_OutsideDevelopment_SuppressesRawMessage()
    {
        IServiceProvider services = GetServices();
        var setup = Substitute.For<ISetupService>();
        setup.TestProviderConnectionAsync(Arg.Any<ProviderConnectionInput>(), Arg.Any<CancellationToken>())
            .Returns<bool>(_ => throw new InvalidOperationException("connect failed at db host 10.0.0.5"));
        var controller = CreateController(services, setup: setup);

        var result = await controller.TestConnection(
            new TestConnectionRequest("p", "https://provider.example", "key", ModelProviderKind.OpenAiCompatible),
            CancellationToken);

        result.Success.Should().BeFalse();
        // Outside Development the raw exception message (host/credential/internal detail) must not leak.
        result.Error.Should().NotContain("10.0.0.5");
        result.Error.Should().StartWith("An unexpected error occurred");
    }

    [TestMethod]
    public async Task TestConnection_WhenSetupThrows_InDevelopment_KeepsRawMessage()
    {
        IServiceProvider services = GetServices();
        var setup = Substitute.For<ISetupService>();
        setup.TestProviderConnectionAsync(Arg.Any<ProviderConnectionInput>(), Arg.Any<CancellationToken>())
            .Returns<bool>(_ => throw new InvalidOperationException("connect failed at db host 10.0.0.5"));
        var controller = CreateController(services, isDevelopment: true, setup: setup);

        var result = await controller.TestConnection(
            new TestConnectionRequest("p", "https://provider.example", "key", ModelProviderKind.OpenAiCompatible),
            CancellationToken);

        result.Success.Should().BeFalse();
        result.Error.Should().Be("connect failed at db host 10.0.0.5");
    }
}
