using Trsr.Domain;
using Trsr.Domain.Completion;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestRunGroup;
using Trsr.Domain.Usage;

namespace Trsr.Application.Demo.Scenarios;

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
        string GroupKey,
        IReadOnlyList<EndpointPick> Endpoints);

    private sealed record EndpointPick(
        Func<DemoSeedContext, IModelEndpoint> SelectEndpoint,
        double PassRate);

    public async Task SeedAsync(CancellationToken cancellationToken)
    {
        var specs = new RunSpec[]
        {
            // Customer Support tone: improving trend, plus a Claude comparison on the latest group
            new("customer-support-tone", "tone-baseline",
                [new(c => c.RequireGpt4oEndpoint(), PassRate: 0.50)]),
            new("customer-support-tone", "tone-after-prompt-tweak",
                [new(c => c.RequireGpt4oEndpoint(), PassRate: 0.67)]),
            new("customer-support-tone", "tone-current",
                [
                    new(c => c.RequireGpt4oEndpoint(), PassRate: 0.83),
                    new(c => c.RequireClaudeEndpoint(), PassRate: 1.00),
                ]),

            // Customer Support refunds: small steady improvement
            new("customer-support-refunds", "refunds-week-1",
                [new(c => c.RequireGpt4oEndpoint(), PassRate: 0.60)]),
            new("customer-support-refunds", "refunds-week-2",
                [new(c => c.RequireGpt4oEndpoint(), PassRate: 0.80)]),

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

            // Analytics: cheaper-model comparison favours gpt-4o-mini
            new("data-analytics-queries", "analytics-baseline",
                [new(c => c.RequireGpt4oEndpoint(), PassRate: 0.75)]),
            new("data-analytics-queries", "analytics-mini-comparison",
                [
                    new(c => c.RequireGpt4oEndpoint(), PassRate: 0.75),
                    new(c => c.RequireGpt4oMiniEndpoint(), PassRate: 0.88),
                ]),
        };

        foreach (var spec in specs)
        {
            if (!ctx.SuitesByKey.TryGetValue(spec.SuiteKey, out var suite))
                throw new InvalidOperationException($"Test suite '{spec.SuiteKey}' not seeded.");

            var group = await createGroup(suite).AddAsync(cancellationToken);
            await group.SetRunning(cancellationToken);

            foreach (var pick in spec.Endpoints)
            {
                var endpoint = pick.SelectEndpoint(ctx);
                var run = await createRun(group, endpoint).AddAsync(cancellationToken);

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
                        TimeSpan.FromMilliseconds(720 + (i * 30)));

                    var evaluations = suite.Evaluators
                        .Select(ev => createEvaluation(
                            ev,
                            shouldPass ? EvaluationScore.Good : EvaluationScore.Bad,
                            shouldPass
                                ? $"{ev.Name}: response matches expected tone and content."
                                : $"{ev.Name}: response is off-target or missing key elements."))
                        .ToArray();

                    var result = await resultRepo.AddAsync(
                        createResult(testCase, completion, evaluations),
                        cancellationToken);
                    current = await current.SetTestResult(result, cancellationToken);
                }

                ctx.AllRuns.Add(current);
            }

            var reloadedGroup = await groupRepo.GetAsync(group.Id, cancellationToken);
            await reloadedGroup.SetCompleted(cancellationToken);
        }
    }
}
