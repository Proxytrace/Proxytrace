using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Trsr.Application.Demo.Internal;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Model;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.ModelProvider;
using Trsr.Storage;
using Trsr.Testing;

namespace Trsr.Application.Tests;

/// <summary>
/// Integration tests that execute the real demo-data JSON scenario files against a SQLite database
/// and assert the expected entities are created. These act as a schema-compatibility guard:
/// any future change to the domain model or JSON scenario files that breaks seeding will fail here.
/// </summary>
[TestClass]
public sealed class DemoDataScriptsIntegrationTests : BaseTest<Module>
{
    // ReSharper disable once NullableWarningSuppressionIsUsed
    private string dbPath = null!;

    protected override void ConfigureContainer(ContainerBuilder builder)
    {
        base.ConfigureContainer(builder);
        builder.RegisterModule(new Storage.Module(StorageConfiguration.Sqlite($"Data Source={dbPath}")));
        builder.RegisterGeneric(typeof(NullLogger<>)).As(typeof(ILogger<>));
    }

    [TestInitialize]
    public void TestInitialize()
    {
        dbPath = Path.Combine(Path.GetTempPath(), $"trsr_demo_integration_{Guid.NewGuid()}.db");
    }

    [TestCleanup]
    public void TestCleanup()
    {
        if (File.Exists(dbPath))
        {
            try
            {
                File.Delete(dbPath);
            }
            catch
            {
                // ignore
            }
        }
    }

    private DemoDataSeeder BuildSeeder(IServiceProvider services) =>
        new(services, NullLogger<DemoDataSeeder>.Instance);

    // ── Happy-path ────────────────────────────────────────────────────────────

    [TestMethod]
    public async Task DemoDataScripts_SeedWithoutThrowing()
    {
        IServiceProvider services = GetServices();
        var action = () => BuildSeeder(services).StartAsync(CancellationToken.None);
        await action.Should().NotThrowAsync();
    }

    [TestMethod]
    public async Task DemoDataScripts_CreateTwoModelProviders()
    {
        IServiceProvider services = GetServices();

        await BuildSeeder(services).StartAsync(CancellationToken.None);

        var count = await services.GetRequiredService<IRepository<IModelProvider>>()
            .CountAsync(CancellationToken.None);

        count.Should().Be(2); // OpenAI + Anthropic
    }

    [TestMethod]
    public async Task DemoDataScripts_CreateThreeModels()
    {
        IServiceProvider services = GetServices();

        await BuildSeeder(services).StartAsync(CancellationToken.None);

        var count = await services.GetRequiredService<IRepository<IModel>>()
            .CountAsync(CancellationToken.None);

        count.Should().Be(3); // gpt-4o, claude-sonnet-4-6, gpt-4o-mini
    }

    [TestMethod]
    public async Task DemoDataScripts_CreateThreeModelEndpoints()
    {
        IServiceProvider services = GetServices();
        await BuildSeeder(services).StartAsync(CancellationToken.None);

        var count = await services.GetRequiredService<IRepository<IModelEndpoint>>()
            .CountAsync(CancellationToken.None);

        count.Should().Be(3); // one per model/provider pair
    }

    [TestMethod]
    public async Task DemoDataScripts_CreateThreeAgents()
    {
        IServiceProvider services = GetServices();
        await BuildSeeder(services).StartAsync(CancellationToken.None);

        var count = await services.GetRequiredService<IRepository<IAgent>>()
            .CountAsync(CancellationToken.None);

        count.Should().Be(3); // customer-support, code-review, data-analytics
    }

    [TestMethod]
    public async Task DemoDataScripts_CreateExpectedAgentCallCount()
    {
        IServiceProvider services = GetServices();
        await BuildSeeder(services).StartAsync(CancellationToken.None);

        var count = await services.GetRequiredService<IRepository<IAgentCall>>()
            .CountAsync(CancellationToken.None);

        // 01_customer_support: 25 calls, 02_code_review: 22 calls, 03_data_analytics: 20 calls
        count.Should().Be(67);
    }

    // ── Idempotency ───────────────────────────────────────────────────────────

    [TestMethod]
    public async Task DemoDataScripts_CalledTwice_DoesNotThrow()
    {
        IServiceProvider services = GetServices();

        // First run seeds the data.
        await BuildSeeder(services).StartAsync(CancellationToken.None);

        // Second run sees existing data and should skip without error.
        var action = () => BuildSeeder(services).StartAsync(CancellationToken.None);
        await action.Should().NotThrowAsync();
    }

    [TestMethod]
    public async Task DemoDataScripts_CalledTwice_AgentCallCountUnchanged()
    {
        IServiceProvider services = GetServices();

        await BuildSeeder(services).StartAsync(CancellationToken.None);
        await BuildSeeder(services).StartAsync(CancellationToken.None);

        var count = await services.GetRequiredService<IRepository<IAgentCall>>()
            .CountAsync(CancellationToken.None);

        count.Should().Be(67);
    }
}
