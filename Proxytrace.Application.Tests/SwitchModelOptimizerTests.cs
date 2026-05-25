using AwesomeAssertions;
using NSubstitute;
using Proxytrace.Application.Optimization.Internal;
using Proxytrace.Application.Statistics;
using Proxytrace.Application.Statistics.TestRun;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.Model;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.Proposal;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;
using Proxytrace.Domain.TestSuite;
using Proxytrace.Testing;

namespace Proxytrace.Application.Tests;

[TestClass]
public sealed class SwitchModelOptimizerTests : BaseTest<Module>
{
    [TestMethod]
    public async Task DiscoverOptimizations_NoRunForCurrentEndpoint_ReturnsEmpty()
    {
        // no spec marked current => agent points at an endpoint without a run
        Fixture fixture = Build(
            Spec("a", cost: 5m, latency: Sec(5)),
            Spec("b", cost: 9m, latency: Sec(5)));

        var proposals = await fixture.Optimizer.DiscoverOptimizations(
            fixture.Group, fixture.Runs, CancellationToken);

        proposals.Should().BeEmpty();
        fixture.Captured.Called.Should().BeFalse();
    }

    [TestMethod]
    public async Task DiscoverOptimizations_FewerThanTwoRunsWithPassRate_ReturnsEmpty()
    {
        // alternative has no test cases => null pass rate => filtered out, leaving only current
        Fixture fixture = Build(
            Spec("current", cost: 10m, latency: Sec(5), isCurrent: true),
            Spec("alt", cost: 1m, latency: Sec(1), passed: 0, total: 0));

        var proposals = await fixture.Optimizer.DiscoverOptimizations(
            fixture.Group, fixture.Runs, CancellationToken);

        proposals.Should().BeEmpty();
        fixture.Captured.Called.Should().BeFalse();
    }

    [TestMethod]
    public async Task DiscoverOptimizations_CurrentAlreadyBest_ReturnsEmpty()
    {
        Fixture fixture = Build(
            Spec("current", cost: 1m, latency: Sec(1), isCurrent: true),
            Spec("alt", cost: 10m, latency: Sec(10)));

        var proposals = await fixture.Optimizer.DiscoverOptimizations(
            fixture.Group, fixture.Runs, CancellationToken);

        proposals.Should().BeEmpty();
        fixture.Captured.Called.Should().BeFalse();
    }

    [TestMethod]
    public async Task DiscoverOptimizations_WinningMarginBelowThreshold_ReturnsEmpty()
    {
        // cheapest beats runner-up by <10%; latency identical everywhere
        Fixture fixture = Build(
            Spec("current", cost: 10m, latency: Sec(5), isCurrent: true),
            Spec("altA", cost: 9.0m, latency: Sec(5)),
            Spec("altB", cost: 9.5m, latency: Sec(5)));

        var proposals = await fixture.Optimizer.DiscoverOptimizations(
            fixture.Group, fixture.Runs, CancellationToken);

        proposals.Should().BeEmpty();
        fixture.Captured.Called.Should().BeFalse();
    }

    [TestMethod]
    public async Task DiscoverOptimizations_OtherStatWorseThanRunnerUp_ReturnsEmpty()
    {
        // altA wins cost with margin, but its latency is worse than the cost runner-up (altB)
        Fixture fixture = Build(
            Spec("current", cost: 10m, latency: Sec(5), isCurrent: true),
            Spec("altA", cost: 5m, latency: Sec(20)),
            Spec("altB", cost: 9m, latency: Sec(6)));

        var proposals = await fixture.Optimizer.DiscoverOptimizations(
            fixture.Group, fixture.Runs, CancellationToken);

        proposals.Should().BeEmpty();
        fixture.Captured.Called.Should().BeFalse();
    }

    [TestMethod]
    public async Task DiscoverOptimizations_PassRateWorseThanRunnerUp_ReturnsEmpty()
    {
        Fixture fixture = Build(
            Spec("current", cost: 10m, latency: Sec(5), isCurrent: true, passed: 8),
            Spec("altA", cost: 5m, latency: Sec(4), passed: 5),
            Spec("altB", cost: 9m, latency: Sec(6), passed: 9));

        var proposals = await fixture.Optimizer.DiscoverOptimizations(
            fixture.Group, fixture.Runs, CancellationToken);

        proposals.Should().BeEmpty();
        fixture.Captured.Called.Should().BeFalse();
    }

    [TestMethod]
    public async Task DiscoverOptimizations_CostWin_ProducesProposal()
    {
        Fixture fixture = Build(
            Spec("current", cost: 10m, latency: Sec(5), isCurrent: true),
            Spec("altA", cost: 5m, latency: Sec(5)),
            Spec("altB", cost: 9m, latency: Sec(5)));

        var proposals = await fixture.Optimizer.DiscoverOptimizations(
            fixture.Group, fixture.Runs, CancellationToken);

        proposals.Should().HaveCount(1);
        Captured c = fixture.Captured;
        c.Endpoint.Should().BeSameAs(fixture.RunsByName["altA"].Endpoint);
        c.Priority.Should().Be(Priority.High); // 50% cost saving vs current
        c.CurrentPassRate.Should().Be(0.8);
        c.ProposedPassRate.Should().Be(0.8);
        c.CostDelta.Should().Be(-5m);
        c.LatencyDelta.Should().Be(TimeSpan.Zero);
        c.EvidenceIds.Should().BeEquivalentTo(
            new[] { fixture.RunsByName["current"].Id, fixture.RunsByName["altA"].Id });
        c.Rationale.Should().Contain("cost");
    }

    [TestMethod]
    public async Task DiscoverOptimizations_LatencyWin_ProducesProposal()
    {
        Fixture fixture = Build(
            Spec("current", cost: 10m, latency: Sec(10), isCurrent: true),
            Spec("altA", cost: 10m, latency: Sec(5)),
            Spec("altB", cost: 10m, latency: Sec(9)));

        var proposals = await fixture.Optimizer.DiscoverOptimizations(
            fixture.Group, fixture.Runs, CancellationToken);

        proposals.Should().HaveCount(1);
        Captured c = fixture.Captured;
        c.Endpoint.Should().BeSameAs(fixture.RunsByName["altA"].Endpoint);
        c.Priority.Should().Be(Priority.High);
        c.CostDelta.Should().Be(0m);
        c.LatencyDelta.Should().Be(Sec(-5));
        c.Rationale.Should().Contain("latency");
    }

    [TestMethod]
    public async Task DiscoverOptimizations_BothMetricsQualify_LargerRelativeSavingWins()
    {
        // cost saving vs current ~16.7%, latency saving vs current 90% => latency wins
        Fixture fixture = Build(
            Spec("current", cost: 12m, latency: Sec(100), isCurrent: true),
            Spec("C", cost: 10m, latency: Sec(50)),
            Spec("L", cost: 50m, latency: Sec(10)),
            Spec("F1", cost: 20m, latency: Sec(60)),
            Spec("F2", cost: 60m, latency: Sec(20)));

        var proposals = await fixture.Optimizer.DiscoverOptimizations(
            fixture.Group, fixture.Runs, CancellationToken);

        proposals.Should().HaveCount(1);
        Captured c = fixture.Captured;
        c.Endpoint.Should().BeSameAs(fixture.RunsByName["L"].Endpoint);
        c.Rationale.Should().Contain("latency");
        c.Priority.Should().Be(Priority.High);
    }

    private static TimeSpan Sec(double seconds) => TimeSpan.FromSeconds(seconds);

    private static RunSpec Spec(
        string name,
        decimal? cost,
        TimeSpan? latency,
        bool isCurrent = false,
        int passed = 8,
        int total = 10)
        => new(name, cost, latency, isCurrent, passed, total);

    private static Fixture Build(params RunSpec[] specs)
    {
        var groupId = Guid.NewGuid();
        var captured = new Captured();
        var runsByName = new Dictionary<string, ITestRun>();
        var stats = new List<TestRunStats>();
        IModelEndpoint? currentEndpoint = null;

        foreach (RunSpec spec in specs)
        {
            var endpointId = Guid.NewGuid();
            var model = Substitute.For<IModel>();
            model.Name.Returns(spec.Name);
            var endpoint = Substitute.For<IModelEndpoint>();
            endpoint.Id.Returns(endpointId);
            endpoint.Model.Returns(model);

            var runId = Guid.NewGuid();
            var run = Substitute.For<ITestRun>();
            run.Id.Returns(runId);
            run.Endpoint.Returns(endpoint);
            runsByName[spec.Name] = run;

            stats.Add(new TestRunStats(
                TestRunId: runId,
                AgentId: Guid.Empty,
                EndpointId: endpointId,
                GroupId: groupId,
                SuiteId: Guid.Empty,
                TestCases: spec.Total,
                Passed: spec.Passed,
                TotalDuration: spec.Latency,
                Usage: null,
                Cost: spec.Cost,
                RunCompletedAt: DateTimeOffset.UtcNow));

            if (spec.IsCurrent)
            {
                currentEndpoint = endpoint;
            }
        }

        if (currentEndpoint is null)
        {
            currentEndpoint = Substitute.For<IModelEndpoint>();
            currentEndpoint.Id.Returns(Guid.NewGuid());
        }

        var agent = Substitute.For<IAgent>();
        agent.Endpoint.Returns(currentEndpoint);

        var suite = Substitute.For<ITestSuite>();
        suite.Agent.Returns(agent);

        var group = Substitute.For<ITestRunGroup>();
        group.Id.Returns(groupId);
        group.Suite.Returns(suite);

        var runStats = Substitute.For<IStatsReader<TestRunStats, TestRunStats.Filter>>();
        runStats.QueryAsync(Arg.Any<TestRunStats.Filter>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<TestRunStats>>(stats));

        IModelSwitchProposal.CreateNew factory = (
            _, priority, rationale, proposedEndpoint, currentPassRate, proposedPassRate,
            costDelta, latencyDelta, evidenceIds, abTestRun) =>
        {
            captured.Called = true;
            captured.Priority = priority;
            captured.Rationale = rationale;
            captured.Endpoint = proposedEndpoint;
            captured.CurrentPassRate = currentPassRate;
            captured.ProposedPassRate = proposedPassRate;
            captured.CostDelta = costDelta;
            captured.LatencyDelta = latencyDelta;
            captured.EvidenceIds = evidenceIds;
            captured.AbTestRun = abTestRun;
            return Substitute.For<IModelSwitchProposal>();
        };

        var optimizer = new SwitchModelOptimizer(factory, runStats);

        return new Fixture
        {
            Optimizer = optimizer,
            Group = group,
            Runs = runsByName.Values.ToList(),
            Captured = captured,
            RunsByName = runsByName,
        };
    }

    private sealed record RunSpec(
        string Name,
        decimal? Cost,
        TimeSpan? Latency,
        bool IsCurrent,
        int Passed,
        int Total);

    private sealed class Fixture
    {
        public required SwitchModelOptimizer Optimizer { get; init; }
        public required ITestRunGroup Group { get; init; }
        public required IReadOnlyList<ITestRun> Runs { get; init; }
        public required Captured Captured { get; init; }
        public required IReadOnlyDictionary<string, ITestRun> RunsByName { get; init; }
    }

    private sealed class Captured
    {
        public bool Called { get; set; }
        public Priority Priority { get; set; }
        public string? Rationale { get; set; }
        public IModelEndpoint? Endpoint { get; set; }
        public double? CurrentPassRate { get; set; }
        public double? ProposedPassRate { get; set; }
        public decimal? CostDelta { get; set; }
        public TimeSpan? LatencyDelta { get; set; }
        public IReadOnlyCollection<Guid>? EvidenceIds { get; set; }
        public ITestRun? AbTestRun { get; set; }
    }
}
