using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.CustomAnomaly;
using Proxytrace.Testing;

namespace Proxytrace.Storage.Tests;

[TestClass]
public sealed class CustomAnomalyDetectorRepositoryTests : BaseTest<Module>
{
    private static Task<IAgent> CreateSystemAgent(IServiceProvider services, string name, CancellationToken cancellationToken)
        => services.GetRequiredService<IAgentGenerator>()
            .CreateAsync(name, isSystemAgent: true, cancellationToken: cancellationToken);

    [TestMethod]
    public async Task AddAsync_WithMixedTriggers_RoundTripsTriggerJson()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<ICustomAnomalyDetectorRepository>();
        var factory = services.GetRequiredService<ICustomAnomalyDetector.CreateNew>();
        var judge = await CreateSystemAgent(services, "Judge", CancellationToken);
        var triggers = new[]
        {
            new AnomalyTrigger(TriggerKind.Phrase, "refund"),
            new AnomalyTrigger(TriggerKind.Regex, @"escalat(e|ion)"),
        };

        var detector = await repo.AddAsync(
            factory("Refunds", judge, triggers, true, [], true), CancellationToken);

        var reloaded = await repo.GetAsync(detector.Id, CancellationToken);
        reloaded.Triggers.Should().BeEquivalentTo(triggers, o => o.WithStrictOrdering());
        reloaded.Agent.Id.Should().Be(judge.Id);
        reloaded.AllAgents.Should().BeTrue();
        reloaded.ScopedAgents.Should().BeEmpty();
    }

    [TestMethod]
    public async Task UpdateRelationsAsync_WhenScopeChanges_SyncsJunctionOnReload()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<ICustomAnomalyDetectorRepository>();
        var factory = services.GetRequiredService<ICustomAnomalyDetector.CreateNew>();
        var agentGenerator = services.GetRequiredService<IAgentGenerator>();
        var judge = await CreateSystemAgent(services, "Judge", CancellationToken);
        var agentA = await agentGenerator.CreateAsync("Agent A", cancellationToken: CancellationToken);
        var agentB = await agentGenerator.CreateAsync("Agent B", cancellationToken: CancellationToken);

        var detector = await repo.AddAsync(
            factory("Scoped", judge, [new AnomalyTrigger(TriggerKind.Phrase, "refund")], false, [agentA], true),
            CancellationToken);

        // Swap the single scoped agent for a different one.
        var updated = await detector.Update(
            detector.Name, detector.Triggers, false, [agentB], detector.IsEnabled, CancellationToken);

        var reloaded = await repo.GetAsync(updated.Id, CancellationToken);
        reloaded.ScopedAgents.Should().ContainSingle().Which.Id.Should().Be(agentB.Id);
    }

    [TestMethod]
    public async Task UpdateRelationsAsync_WhenSwitchedToAllAgents_ClearsJunction()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<ICustomAnomalyDetectorRepository>();
        var factory = services.GetRequiredService<ICustomAnomalyDetector.CreateNew>();
        var judge = await CreateSystemAgent(services, "Judge", CancellationToken);
        var agent = await services.GetRequiredService<IAgentGenerator>()
            .CreateAsync("Agent", cancellationToken: CancellationToken);

        var detector = await repo.AddAsync(
            factory("Scoped", judge, [new AnomalyTrigger(TriggerKind.Phrase, "refund")], false, [agent], true),
            CancellationToken);

        var updated = await detector.Update(
            detector.Name, detector.Triggers, true, [], detector.IsEnabled, CancellationToken);

        var reloaded = await repo.GetAsync(updated.Id, CancellationToken);
        reloaded.AllAgents.Should().BeTrue();
        reloaded.ScopedAgents.Should().BeEmpty();
    }

    [TestMethod]
    public async Task GetEnabledByProjectAsync_ReturnsOnlyEnabledDetectorsOfProject()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<ICustomAnomalyDetectorRepository>();
        var factory = services.GetRequiredService<ICustomAnomalyDetector.CreateNew>();
        var judge = await CreateSystemAgent(services, "Judge", CancellationToken);
        var trigger = new AnomalyTrigger(TriggerKind.Phrase, "refund");

        var enabled = await repo.AddAsync(factory("Enabled", judge, [trigger], true, [], true), CancellationToken);
        await repo.AddAsync(factory("Disabled", judge, [trigger], true, [], false), CancellationToken);

        var result = await repo.GetEnabledByProjectAsync(judge.Project.Id, CancellationToken);

        result.Should().ContainSingle().Which.Id.Should().Be(enabled.Id);

        var otherProject = await repo.GetEnabledByProjectAsync(Guid.NewGuid(), CancellationToken);
        otherProject.Should().BeEmpty();
    }

    [TestMethod]
    public async Task GetByProjectAsync_ReturnsEnabledAndDisabledDetectors()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<ICustomAnomalyDetectorRepository>();
        var factory = services.GetRequiredService<ICustomAnomalyDetector.CreateNew>();
        var judge = await CreateSystemAgent(services, "Judge", CancellationToken);
        var trigger = new AnomalyTrigger(TriggerKind.Phrase, "refund");

        await repo.AddAsync(factory("Enabled", judge, [trigger], true, [], true), CancellationToken);
        await repo.AddAsync(factory("Disabled", judge, [trigger], true, [], false), CancellationToken);

        var result = await repo.GetByProjectAsync(judge.Project.Id, CancellationToken);

        result.Should().HaveCount(2);
    }
}
