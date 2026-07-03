using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.CustomAnomaly;

namespace Proxytrace.Domain.Tests;

[TestClass]
public sealed class CustomAnomalyDetectorValidationTests : DomainTest<Module>
{
    private static readonly AnomalyTrigger PhraseTrigger = new(TriggerKind.Phrase, "refund");

    private static Task<IAgent> CreateSystemAgent(IServiceProvider services, CancellationToken cancellationToken)
        => services.GetRequiredService<IAgentGenerator>()
            .CreateAsync("Anomaly Judge", isSystemAgent: true, cancellationToken: cancellationToken);

    // ── factory / construction ────────────────────────────────────────────────

    [TestMethod]
    public async Task CreateNew_WithValidInputs_CreatesDetector()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ICustomAnomalyDetector.CreateNew>();
        var agent = await CreateSystemAgent(services, CancellationToken);

        var detector = factory("Refund promises", agent, [PhraseTrigger], true, [], true);

        detector.Should().NotBeNull();
        detector.Name.Should().Be("Refund promises");
        detector.Agent.Should().Be(agent);
        detector.Triggers.Should().ContainSingle().Which.Should().Be(PhraseTrigger);
        detector.AllAgents.Should().BeTrue();
        detector.ScopedAgents.Should().BeEmpty();
        detector.IsEnabled.Should().BeTrue();
        detector.Project.Should().Be(agent.Project);
        detector.Id.Should().NotBe(Guid.Empty);
    }

    [TestMethod]
    public async Task CreateNew_CalledTwice_ProducesDifferentIds()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ICustomAnomalyDetector.CreateNew>();
        var agent = await CreateSystemAgent(services, CancellationToken);

        var first = factory("Detector", agent, [PhraseTrigger], true, [], true);
        var second = factory("Detector", agent, [PhraseTrigger], true, [], true);

        first.Id.Should().NotBe(second.Id);
    }

    [TestMethod]
    public async Task CreateNew_EmptyName_Throws()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ICustomAnomalyDetector.CreateNew>();
        var agent = await CreateSystemAgent(services, CancellationToken);

        var act = () => factory("  ", agent, [PhraseTrigger], true, [], true);

        act.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_NoTriggers_Throws()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ICustomAnomalyDetector.CreateNew>();
        var agent = await CreateSystemAgent(services, CancellationToken);

        var act = () => factory("Detector", agent, [], true, [], true);

        act.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_MoreThanTwentyTriggers_Throws()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ICustomAnomalyDetector.CreateNew>();
        var agent = await CreateSystemAgent(services, CancellationToken);
        var triggers = Enumerable.Range(0, ICustomAnomalyDetector.MaxTriggers + 1)
            .Select(i => new AnomalyTrigger(TriggerKind.Phrase, $"phrase-{i}"))
            .ToArray();

        var act = () => factory("Detector", agent, triggers, true, [], true);

        act.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_EmptyTriggerPattern_Throws()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ICustomAnomalyDetector.CreateNew>();
        var agent = await CreateSystemAgent(services, CancellationToken);

        var act = () => factory("Detector", agent, [new AnomalyTrigger(TriggerKind.Phrase, " ")], true, [], true);

        act.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_MalformedRegexTrigger_Throws()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ICustomAnomalyDetector.CreateNew>();
        var agent = await CreateSystemAgent(services, CancellationToken);

        var act = () => factory("Detector", agent, [new AnomalyTrigger(TriggerKind.Regex, "[unclosed")], true, [], true);

        act.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_BackreferenceRegexTrigger_Throws()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ICustomAnomalyDetector.CreateNew>();
        var agent = await CreateSystemAgent(services, CancellationToken);

        // Backreferences parse under classic Regex but are rejected by NonBacktracking — the point
        // of validating with the SAME options the review pipeline matches with.
        var act = () => factory("Detector", agent, [new AnomalyTrigger(TriggerKind.Regex, @"(a)\1")], true, [], true);

        act.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_NonSystemAgent_Throws()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ICustomAnomalyDetector.CreateNew>();
        var agent = await services.GetRequiredService<IAgentGenerator>()
            .CreateAsync("Regular Agent", isSystemAgent: false, cancellationToken: CancellationToken);

        var act = () => factory("Detector", agent, [PhraseTrigger], true, [], true);

        act.Should().Throw<Exception>();
    }

    [TestMethod]
    public async Task CreateNew_NotAllAgentsWithEmptyScope_Throws()
    {
        IServiceProvider services = GetServices();
        var factory = services.GetRequiredService<ICustomAnomalyDetector.CreateNew>();
        var agent = await CreateSystemAgent(services, CancellationToken);

        var act = () => factory("Detector", agent, [PhraseTrigger], false, [], true);

        act.Should().Throw<Exception>();
    }

    // ── round-trip / persistence ──────────────────────────────────────────────

    [TestMethod]
    public async Task Generator_CreateAsync_RoundTripsThroughRepository()
    {
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IRepository<ICustomAnomalyDetector>>();
        var detector = await services.GetRequiredService<IDomainEntityGenerator<ICustomAnomalyDetector>>()
            .CreateAsync(CancellationToken);

        var reloaded = await repository.GetAsync(detector.Id, CancellationToken);

        reloaded.Id.Should().Be(detector.Id);
        reloaded.Name.Should().Be(detector.Name);
        reloaded.Agent.Id.Should().Be(detector.Agent.Id);
        reloaded.Triggers.Should().BeEquivalentTo(detector.Triggers, o => o.WithStrictOrdering());
        reloaded.AllAgents.Should().Be(detector.AllAgents);
        reloaded.IsEnabled.Should().Be(detector.IsEnabled);
        reloaded.CreatedAt.Should().Be(detector.CreatedAt);
    }

    [TestMethod]
    public async Task Update_PersistsChangedFields()
    {
        IServiceProvider services = GetServices();
        var repository = services.GetRequiredService<IRepository<ICustomAnomalyDetector>>();
        var detector = await services.GetRequiredService<IDomainEntityGenerator<ICustomAnomalyDetector>>()
            .CreateAsync(CancellationToken);
        var scopedAgent = await services.GetRequiredService<IAgentGenerator>()
            .CreateAsync("Scoped Agent", cancellationToken: CancellationToken);
        var newTriggers = new[]
        {
            new AnomalyTrigger(TriggerKind.Regex, "escalat(e|ion)"),
            new AnomalyTrigger(TriggerKind.Phrase, "lawsuit"),
        };

        await detector.Update("Renamed", newTriggers, false, [scopedAgent], false, CancellationToken);

        var reloaded = await repository.GetAsync(detector.Id, CancellationToken);
        reloaded.Name.Should().Be("Renamed");
        reloaded.Triggers.Should().BeEquivalentTo(newTriggers, o => o.WithStrictOrdering());
        reloaded.AllAgents.Should().BeFalse();
        reloaded.ScopedAgents.Should().ContainSingle().Which.Id.Should().Be(scopedAgent.Id);
        reloaded.IsEnabled.Should().BeFalse();
    }

    [TestMethod]
    public async Task Update_ToInvalidTriggers_Throws()
    {
        IServiceProvider services = GetServices();
        var detector = await services.GetRequiredService<IDomainEntityGenerator<ICustomAnomalyDetector>>()
            .CreateAsync(CancellationToken);

        await FluentActions
            .Invoking(() => detector.Update(detector.Name, [], detector.AllAgents, [], detector.IsEnabled, CancellationToken))
            .Should().ThrowAsync<Exception>();
    }
}
