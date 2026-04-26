using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Trsr.Api.Services.Internal;
using Trsr.Domain;
using Trsr.Domain.AgentCall;
using Trsr.Storage;
using Trsr.Testing;

namespace Trsr.Api.Tests;

[TestClass]
public sealed class DemoDataSeederTests : BaseTest<Module>
{
    private IServiceProvider GetServicesWithFakeInitializer(FakeDatabaseInitializer fake)
        => GetServices(builder =>
            builder
                .RegisterInstance(fake)
                .As<IDatabaseInitializer>()
                .SingleInstance());

    private static DemoDataSeeder BuildSeeder(IServiceProvider services)
        => new(services, NullLogger<DemoDataSeeder>.Instance);

    [TestMethod]
    public async Task StartAsync_WhenDatabaseIsEmpty_CallsEnsureDatabaseReady()
    {
        // Arrange
        var fake = new FakeDatabaseInitializer();
        var services = GetServicesWithFakeInitializer(fake);
        var seeder = BuildSeeder(services);

        // Act
        await seeder.StartAsync(CancellationToken);

        // Assert
        fake.EnsureDatabaseReadyCalled.Should().BeTrue();
    }

    [TestMethod]
    public async Task StartAsync_WhenDatabaseHasData_StillCallsEnsureDatabaseReady()
    {
        // Arrange
        var fake = new FakeDatabaseInitializer();
        var services = GetServicesWithFakeInitializer(fake);

        var generator = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();
        await generator.CreateAsync(CancellationToken);

        var seeder = BuildSeeder(services);

        // Act
        await seeder.StartAsync(CancellationToken);

        // Assert
        fake.EnsureDatabaseReadyCalled.Should().BeTrue();
    }

    [TestMethod]
    public async Task StartAsync_WhenDatabaseIsEmpty_SeedsAgentCalls()
    {
        // Arrange
        var fake = new FakeDatabaseInitializer();
        var services = GetServicesWithFakeInitializer(fake);
        var seeder = BuildSeeder(services);

        // Act
        await seeder.StartAsync(CancellationToken);

        // Assert
        var count = await services.GetRequiredService<IRepository<IAgentCall>>()
            .CountAsync(CancellationToken);
        count.Should().BeGreaterThan(0);
    }

    [TestMethod]
    public async Task StartAsync_WhenDatabaseHasData_DoesNotSeedAdditionalAgentCalls()
    {
        // Arrange
        var fake = new FakeDatabaseInitializer();
        var services = GetServicesWithFakeInitializer(fake);

        var generator = services.GetRequiredService<IDomainEntityGenerator<IAgentCall>>();
        await generator.CreateAsync(CancellationToken);

        var seeder = BuildSeeder(services);

        // Act
        await seeder.StartAsync(CancellationToken);

        // Assert — only the one pre-existing call remains; seeder skipped
        var count = await services.GetRequiredService<IRepository<IAgentCall>>()
            .CountAsync(CancellationToken);
        count.Should().Be(1);
    }

    [TestMethod]
    public async Task StopAsync_CompletesSuccessfully()
    {
        // Arrange
        var fake = new FakeDatabaseInitializer();
        var services = GetServicesWithFakeInitializer(fake);
        var seeder = BuildSeeder(services);

        // Act
        var action = () => seeder.StopAsync(CancellationToken);

        // Assert
        await action.Should().NotThrowAsync();
    }
}

internal sealed class FakeDatabaseInitializer : IDatabaseInitializer
{
    public bool EnsureDatabaseReadyCalled { get; private set; }

    public Task EnsureDatabaseReadyAsync(CancellationToken cancellationToken = default)
    {
        EnsureDatabaseReadyCalled = true;
        return Task.CompletedTask;
    }
}
