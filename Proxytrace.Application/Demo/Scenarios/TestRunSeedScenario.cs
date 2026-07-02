using JetBrains.Annotations;
using Proxytrace.Domain;
using Proxytrace.Domain.Completion;
using Proxytrace.Domain.Evaluation;
using Proxytrace.Domain.Evaluator;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.TestResult;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;
using Proxytrace.Domain.TestSuite;
using Proxytrace.Domain.Usage;

namespace Proxytrace.Application.Demo.Scenarios;

[UsedImplicitly]
internal sealed class TestRunSeedScenario : IDemoScenario
{
    private readonly DemoSeedContext ctx;
    private readonly ITestRunGroup.CreateNew createGroup;
    private readonly ITestRun.CreateNew createRun;
    private readonly ITestResult.CreateNew createResult;
    private readonly ICompletion.Create createCompletion;
    private readonly IEvaluation.Create createEvaluation;
    private readonly IRepository<ITestRunGroup> groupRepo;
    private readonly IRepository<ITestResult> resultRepo;

    public TestRunSeedScenario(
        DemoSeedContext ctx,
        ITestRunGroup.CreateNew createGroup,
        ITestRun.CreateNew createRun,
        ITestResult.CreateNew createResult,
        ICompletion.Create createCompletion,
        IEvaluation.Create createEvaluation,
        IRepository<ITestRunGroup> groupRepo,
        IRepository<ITestResult> resultRepo)
    {
        this.ctx = ctx;
        this.createGroup = createGroup;
        this.createRun = createRun;
        this.createResult = createResult;
        this.createCompletion = createCompletion;
        this.createEvaluation = createEvaluation;
        this.groupRepo = groupRepo;
        this.resultRepo = resultRepo;
    }

    public int Order => 30;

    private sealed record RunSpec(
        string SuiteKey,
        [UsedImplicitly] string GroupKey,
        IReadOnlyList<EndpointPick> Endpoints,
        bool IsRegressedTriageGroup = false);

    [UsedImplicitly]
    private sealed record EndpointPick(
        Func<DemoSeedContext, IModelEndpoint> SelectEndpoint,
        double PassRate,
        int LatencyBaseMs = 720);

    public async Task SeedAsync(CancellationToken cancellationToken)
    {
        var specs = new RunSpec[]
        {
            // Customer Support tone: improving trend, plus a Claude comparison on the latest group
            new("customer-support-tone", "tone-baseline",
                [new(c => c.RequireGpt54Endpoint(), PassRate: 0.50)]),
            new("customer-support-tone", "tone-after-prompt-tweak",
                [new(c => c.RequireGpt54Endpoint(), PassRate: 0.67)]),
            new("customer-support-tone", "tone-current",
                [
                    new(c => c.RequireGpt54Endpoint(), PassRate: 0.83),
                    new(c => c.RequireClaudeEndpoint(), PassRate: 1.00),
                ]),

            // Customer Support refunds: small steady improvement
            new("customer-support-refunds", "refunds-week-1",
                [new(c => c.RequireGpt54Endpoint(), PassRate: 0.60)]),
            new("customer-support-refunds", "refunds-week-2",
                [new(c => c.RequireGpt54Endpoint(), PassRate: 0.80)]),

            // Code review bugs: high pass rate from the start
            new("code-review-bugs", "bugs-initial",
                [new(c => c.RequireClaudeEndpoint(), PassRate: 0.86)]),
            new("code-review-bugs", "bugs-rerun",
                [new(c => c.RequireClaudeEndpoint(), PassRate: 0.86)]),

            // Code review style: stagnant; motivates a rejected prompt proposal
            new("code-review-style", "style-baseline",
                [new(c => c.RequireClaudeEndpoint(), PassRate: 0.40)]),
            new("code-review-style", "style-after-prompt-attempt",
                [new(c => c.RequireClaudeEndpoint(), PassRate: 0.40)]),

            // Analytics: cheaper-model comparison favours gpt-5.4-mini
            new("data-analytics-queries", "analytics-baseline",
                [new(c => c.RequireGpt54Endpoint(), PassRate: 0.75)]),
            new("data-analytics-queries", "analytics-mini-comparison",
                [
                    new(c => c.RequireGpt54Endpoint(), PassRate: 0.75),
                    new(c => c.RequireGpt54MiniEndpoint(), PassRate: 0.88),
                ]),

            // Email triage: a stable baseline, then a fresh sharp regression (pass rate and
            // latency) shaped to trip the real anomaly detector's rules during seeding. The two
            // hard cases at the end of the suite fail in every run, including the baseline.
            new("email-triage-priority", "triage-baseline",
                [new(c => c.RequireGpt54MiniEndpoint(), PassRate: 0.75)]),
            new("email-triage-priority", "triage-week-2",
                [new(c => c.RequireGpt54MiniEndpoint(), PassRate: 0.75)]),
            new("email-triage-priority", "triage-week-3",
                [new(c => c.RequireGpt54MiniEndpoint(), PassRate: 0.75)]),
            new("email-triage-priority", "triage-regression",
                [new(c => c.RequireGpt54MiniEndpoint(), PassRate: 0.25, LatencyBaseMs: 1290)],
                IsRegressedTriageGroup: true),
        };

        foreach (var spec in specs)
        {
            var suite = RequireSuite(spec.SuiteKey);

            var group = await createGroup(suite, isSystemRun: false, null, sampleCount: 1).AddAsync(cancellationToken);
            await group.SetRunning(cancellationToken);

            foreach (var pick in spec.Endpoints)
            {
                var run = await SeedRunAsync(suite, group, pick, cancellationToken);
                ctx.AllRuns.Add(run);
            }

            var reloadedGroup = await groupRepo.GetAsync(group.Id, cancellationToken);
            reloadedGroup = await reloadedGroup.SetCompleted(cancellationToken);

            if (spec.IsRegressedTriageGroup)
                ctx.RegressedTriageGroup = reloadedGroup;
        }

        await SeedFailedToneGroupAsync(cancellationToken);
        await SeedAbCandidateRunsAsync(cancellationToken);
    }

    private ITestSuite RequireSuite(string suiteKey)
        => ctx.SuitesByKey.TryGetValue(suiteKey, out var suite)
            ? suite
            : throw new InvalidOperationException($"Test suite '{suiteKey}' not seeded.");

    /// <summary>
    /// The endpoint-down shape: a group that starts running, whose single run never produces a
    /// result, and which is then marked failed — exactly what the anomaly detector's hard rule
    /// looks for. Kept out of <see cref="DemoSeedContext.AllRuns"/> so it is neither backdated nor
    /// cited as evidence: it is "today's" incident.
    /// </summary>
    private async Task SeedFailedToneGroupAsync(CancellationToken cancellationToken)
    {
        var suite = RequireSuite("customer-support-tone");

        var group = await createGroup(suite, isSystemRun: false, null, sampleCount: 1).AddAsync(cancellationToken);
        await group.SetRunning(cancellationToken);
        await createRun(group, ctx.RequireClaudeEndpoint(), sampleIndex: 0).AddAsync(cancellationToken);

        var reloaded = await groupRepo.GetAsync(group.Id, cancellationToken);
        ctx.FailedToneGroup = await reloaded.SetFailed(cancellationToken);
    }

    /// <summary>
    /// Hidden system A/B candidate runs (one per agent that has a validated/invalidated theory), so
    /// theories and proposals can point their A/B evidence at a real run entity.
    /// </summary>
    private async Task SeedAbCandidateRunsAsync(CancellationToken cancellationToken)
    {
        var candidates = new (string SuiteKey, Func<DemoSeedContext, IModelEndpoint> SelectEndpoint, double PassRate)[]
        {
            ("customer-support-tone", c => c.RequireGpt54Endpoint(), 0.90),
            ("data-analytics-queries", c => c.RequireGpt54MiniEndpoint(), 0.88),
        };

        foreach (var (suiteKey, selectEndpoint, passRate) in candidates)
        {
            var suite = RequireSuite(suiteKey);
            var group = await createGroup(suite, isSystemRun: true, null, sampleCount: 1).AddAsync(cancellationToken);
            await group.SetRunning(cancellationToken);

            var run = await SeedRunAsync(
                suite, group, new EndpointPick(selectEndpoint, passRate), cancellationToken);

            var reloaded = await groupRepo.GetAsync(group.Id, cancellationToken);
            await reloaded.SetCompleted(cancellationToken);

            ctx.AbCandidateRunsByAgent[suite.Agent.Id] = run;
        }
    }

    private async Task<ITestRun> SeedRunAsync(
        ITestSuite suite,
        ITestRunGroup group,
        EndpointPick pick,
        CancellationToken cancellationToken)
    {
        var endpoint = pick.SelectEndpoint(ctx);
        var run = await createRun(group, endpoint, sampleIndex: 0).AddAsync(cancellationToken);

        var cases = suite.TestCases.ToArray();
        int passing = (int)Math.Round(pick.PassRate * cases.Length);

        ITestRun current = run;
        for (int i = 0; i < cases.Length; i++)
        {
            var testCase = cases[i];
            bool shouldPass = i < passing;
            var actualResponse = shouldPass
                ? testCase.ExpectedOutput
                : new AssistantMessage(
                    [Content.FromText("(simulated weaker response for demo)")],
                    []);

            var completion = createCompletion(
                actualResponse,
                new TokenUsage(inputTokenCount: 240, outputTokenCount: 90),
                TimeSpan.FromMilliseconds(pick.LatencyBaseMs + (i * 30)));

            var evaluations = suite.Evaluators
                .Select(ev =>
                {
                    TokenUsage? evalUsage = null;
                    decimal? evalCost = null;
                    if (ev is IAgenticEvaluator agentic)
                    {
                        evalUsage = new TokenUsage(inputTokenCount: 360UL + (ulong)(i * 4), outputTokenCount: 55UL + (ulong)(i * 2));
                        evalCost = agentic.Agent.Endpoint.CalculateCost(evalUsage);
                    }
                    return createEvaluation(
                        ev,
                        shouldPass ? EvaluationScore.Good : EvaluationScore.Bad,
                        TimeSpan.FromMilliseconds(120 + (i * 5)),
                        tokenUsage: evalUsage,
                        cost: evalCost,
                        reasoning: shouldPass
                            ? $"{ev.Name}: response matches expected tone and content."
                            : $"{ev.Name}: response is off-target or missing key elements.");
                })
                .ToArray();

            var result = await resultRepo.AddAsync(
                createResult(testCase, completion, evaluations),
                cancellationToken);
            current = await current.SetTestResult(result, cancellationToken);
        }

        return current;
    }
}
