using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Application.Demo;
using Trsr.Domain;
using Trsr.Domain.Evaluator;
using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestSuite;
using Trsr.Testing;

namespace Trsr.Application.Tests.Demo;

[TestClass]
public class DemoSeedingTests : BaseTest<Module>
{
    // Seeding the full demo dataset is expensive (hundreds of entities), so it runs once
    // for the whole class and every test asserts read-only against the shared result.
    private static IContainer? sharedContainer;
    private static IServiceProvider services = null!;

    [ClassInitialize]
    public static async Task SeedOnce(TestContext testContext)
    {
        sharedContainer = BuildContainer(builder =>
            builder.RegisterInstance(new KioskOptions
            {
                Enabled = true,
                DemoUserEmail = "demo@trsr.dev",
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
        ctx.SuitesByKey.Should().HaveCount(5);
        ctx.AllRuns.Should().HaveCountGreaterThan(10);

        var suites = await services.GetRequiredService<IRepository<ITestSuite>>()
            .GetAllAsync(CancellationToken);
        suites.Should().HaveCount(5);

        var evaluators = await services.GetRequiredService<IRepository<IEvaluator>>()
            .GetAllAsync(CancellationToken);
        evaluators.Should().HaveCount(2);
        evaluators.Should().AllBeAssignableTo<IAgenticEvaluator>();

        var proposals = await services.GetRequiredService<IRepository<IOptimizationProposal>>()
            .GetAllAsync(CancellationToken);
        proposals.Should().HaveCount(8);
        proposals.Select(p => p.Status).Should().Contain(
            [ProposalStatus.Draft, ProposalStatus.Accepted, ProposalStatus.Rejected]);
        proposals.Select(p => p.Kind).Should().Contain(
            [ProposalKind.ModelSwitch, ProposalKind.SystemPrompt, ProposalKind.Tool]);
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
