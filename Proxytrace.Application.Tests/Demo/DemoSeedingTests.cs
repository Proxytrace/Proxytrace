using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Application.Demo;
using Proxytrace.Domain;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.Evaluator;
using Proxytrace.Domain.Kiosk;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.Notification;
using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.OptimizationTheory;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestSuite;
using Proxytrace.Domain.Usage;
using Proxytrace.Testing;

namespace Proxytrace.Application.Tests.Demo;

[TestClass]
public class DemoSeedingTests : BaseTest<Module>
{
    // Seeding the full demo dataset is expensive (hundreds of entities), so it runs once
    // for the whole class and every test asserts read-only against the shared result.
    private static IContainer? sharedContainer;
    // ReSharper disable once NullableWarningSuppressionIsUsed
    private static IServiceProvider services = null!;

    [ClassInitialize]
    public static async Task SeedOnce(TestContext testContext)
    {
        sharedContainer = BuildContainer(builder =>
            builder.RegisterInstance(new KioskOptions
            {
                Enabled = true,
                DemoUserEmail = "demo@proxytrace.dev",
                DemoUserName = "Demo Visitor",
            }).AsSelf());

        services = sharedContainer.Resolve<IServiceProvider>();

        var scenarios = services.GetServices<IDemoScenario>()
            .OrderBy(s => s.Order)
            .ToList();

        scenarios.Should().NotBeEmpty("the test container must register every IDemoScenario");

        foreach (var scenario in scenarios)
            await scenario.SeedAsync(testContext.CancellationToken);
    }

    [ClassCleanup]
    public static void DisposeOnce()
    {
        sharedContainer?.Dispose();
        sharedContainer = null;
    }

    [TestMethod]
    public async Task Seed_All_Scenarios_Populates_Expected_Entity_Counts()
    {
        var ctx = services.GetRequiredService<DemoSeedContext>();
        ctx.Helpfulness.Should().NotBeNull();
        ctx.Politeness.Should().NotBeNull();
        ctx.SuitesByKey.Should().HaveCount(6);
        ctx.AllRuns.Should().HaveCountGreaterThan(10);

        var suites = await services.GetRequiredService<IRepository<ITestSuite>>()
            .GetAllAsync(CancellationToken);
        suites.Should().HaveCount(6);

        var evaluators = await services.GetRequiredService<IRepository<IEvaluator>>()
            .GetAllAsync(CancellationToken);
        evaluators.Should().HaveCount(2);
        evaluators.Should().AllBeAssignableTo<IAgenticEvaluator>();

        var proposals = await services.GetRequiredService<IRepository<IOptimizationProposal>>()
            .GetAllAsync(CancellationToken);
        proposals.Should().HaveCount(9);
        proposals.Select(p => p.Status).Should().Contain(
            [ProposalStatus.Draft, ProposalStatus.Accepted, ProposalStatus.Rejected, ProposalStatus.Adopted]);
        proposals.Select(p => p.Kind).Should().Contain(
            [ProposalKind.ModelSwitch, ProposalKind.SystemPrompt, ProposalKind.Tool]);
    }

    [TestMethod]
    public async Task Seed_Endpoints_Price_Traces_With_Displayable_Cost()
    {
        var endpoints = await services.GetRequiredService<IRepository<IModelEndpoint>>()
            .GetAllAsync(CancellationToken);
        endpoints.Should().NotBeEmpty();

        // Prices are EUR per 1M tokens (see ModelEndpoint.CalculateCost). A typical demo trace
        // (~10k in / 500 out) must cost at least €0.0001, i.e. render non-zero in the UI's
        // four-decimal cost display — per-token prices (1M× too small) show €0.0000 everywhere.
        foreach (var endpoint in endpoints.Where(e => e.InputTokenCost is not null))
        {
            var cost = endpoint.CalculateCost(new TokenUsage(10_000, 500, 0));
            cost.Should().NotBeNull();
            cost.Should().BeGreaterThanOrEqualTo(0.0001m,
                $"endpoint '{endpoint.Model.Name}' must price a typical trace above the UI display threshold");
        }
    }

    [TestMethod]
    public async Task Seed_Flags_Outlier_Calls_With_Every_Flag_Kind()
    {
        var calls = await services.GetRequiredService<IRepository<IAgentCall>>()
            .GetAllAsync(CancellationToken);

        var flagged = calls.Where(c => c.OutlierFlags != OutlierFlags.None).ToList();
        flagged.Should().NotBeEmpty("the kiosk must showcase outlier traces");

        // The curated outlier scenario is deterministic, so every flag kind must be present.
        var seen = flagged.Aggregate(OutlierFlags.None, (acc, c) => acc | c.OutlierFlags);
        seen.Should().HaveFlag(OutlierFlags.HighTokens);
        seen.Should().HaveFlag(OutlierFlags.HighLatency);
        seen.Should().HaveFlag(OutlierFlags.LowCacheHit);
        seen.Should().HaveFlag(OutlierFlags.ManyToolCalls);
    }

    [TestMethod]
    public async Task Seed_Raises_Real_Anomaly_Notifications_For_Incident_Groups()
    {
        var ctx = services.GetRequiredService<DemoSeedContext>();
        var notifications = await services.GetRequiredService<IRepository<INotification>>()
            .GetAllAsync(CancellationToken);

        var anomalies = notifications.Where(n => n.Kind == NotificationKind.Anomaly).ToList();

        // The regressed triage group must have produced a critical regression alert (pass-rate
        // drop ≥ the critical threshold), targeting the group itself.
        anomalies.Should().Contain(n =>
            n.Severity == NotificationSeverity.Critical
            && n.TargetKind == NotificationTargetKind.TestRunGroup
            && n.TargetId == ctx.RequireRegressedTriageGroup().Id
            && n.Title.StartsWith("Performance regression"));

        // The endpoint-down tone group must have produced the hard failure alert.
        anomalies.Should().Contain(n =>
            n.Severity == NotificationSeverity.Critical
            && n.TargetKind == NotificationTargetKind.TestRunGroup
            && n.TargetId == ctx.RequireFailedToneGroup().Id
            && n.Title.StartsWith("Test run failed"));
    }

    [TestMethod]
    public async Task Terminal_Theories_Reference_The_Seeded_AB_Candidate_Run()
    {
        var runRepo = services.GetRequiredService<IRepository<ITestRun>>();
        var theories = await services.GetRequiredService<IRepository<IOptimizationTheory>>()
            .GetAllAsync(CancellationToken);

        var terminal = theories
            .Where(t => t.Status is TheoryStatus.Validated or TheoryStatus.Invalidated)
            .ToList();
        terminal.Should().NotBeEmpty();

        foreach (var theory in terminal)
        {
            theory.ABTestRunId.Should().NotBeNull(
                $"terminal theory '{theory.Rationale[..Math.Min(40, theory.Rationale.Length)]}…' should link its A/B run");

            var contained = await runRepo.ContainsAsync(theory.ABTestRunId.Value, CancellationToken);
            contained.Should().BeTrue("the linked A/B candidate run must exist");
        }
    }

    [TestMethod]
    public async Task Validated_Theories_Link_Distinct_Proposals()
    {
        var theories = await services.GetRequiredService<IRepository<IOptimizationTheory>>()
            .GetAllAsync(CancellationToken);

        // A proposal represents a single change through one review lifecycle; two theories must
        // never share one, or promoting/dismissing one silently mutates the other and the second
        // "Promote" 409s (Draft→Accepted refused once the shared proposal is already Accepted).
        var linkedProposalIds = theories
            .Select(t => t.ResultingProposalId)
            .OfType<Guid>()
            .ToList();

        linkedProposalIds.Should().OnlyHaveUniqueItems(
            "each seeded theory must back onto its own proposal — a shared proposal breaks the promote flow");
    }

    [TestMethod]
    public async Task Proposals_Reference_Valid_TestRuns()
    {
        var runRepo = services.GetRequiredService<IRepository<ITestRun>>();
        var proposals = await services.GetRequiredService<IRepository<IOptimizationProposal>>()
            .GetAllAsync(CancellationToken);

        foreach (var proposal in proposals)
        {
            proposal.EvidenceTestRunIds.Should().NotBeEmpty(
                $"proposal '{proposal.Rationale[..Math.Min(40, proposal.Rationale.Length)]}…' should cite evidence");

            foreach (var runId in proposal.EvidenceTestRunIds)
            {
                var contained = await runRepo.ContainsAsync(runId, CancellationToken);
                contained.Should().BeTrue($"run {runId} cited by proposal must exist");
            }
        }
    }

    [TestMethod]
    public async Task Suites_Reference_Only_Seeded_Evaluators()
    {
        var evaluators = await services.GetRequiredService<IRepository<IEvaluator>>()
            .GetAllAsync(CancellationToken);
        var evaluatorIds = evaluators.Select(e => e.Id).ToHashSet();

        var suites = await services.GetRequiredService<IRepository<ITestSuite>>()
            .GetAllAsync(CancellationToken);

        foreach (var suite in suites)
        {
            suite.Evaluators.Should().NotBeEmpty();
            foreach (var ev in suite.Evaluators)
                evaluatorIds.Should().Contain(ev.Id);
        }
    }
}
