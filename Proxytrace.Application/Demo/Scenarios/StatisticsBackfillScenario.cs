using System.Net;
using JetBrains.Annotations;
using Proxytrace.Common.Random;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.Completion;
using Proxytrace.Domain.Inference;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.TestResult;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;
using Proxytrace.Domain.Usage;

namespace Proxytrace.Application.Demo.Scenarios;

[UsedImplicitly]
internal sealed class StatisticsBackfillScenario : IDemoScenario
{
    private const int WindowDays = 14;
    private const int MinCallsPerDay = 50;
    private const int MaxCallsPerDay = 81;
    private const double ErrorRate = 0.03;
    private const double LatencyTailRate = 0.05;

    private static readonly int[] DiurnalWeights =
        [2, 1, 1, 1, 1, 2, 4, 7, 9, 10, 10, 9, 8, 9, 10, 10, 9, 7, 5, 4, 3, 3, 2, 2];

    private static readonly (HttpStatusCode Status, string Message)[] ErrorVariants =
    [
        (HttpStatusCode.TooManyRequests, "rate_limit_exceeded"),
        (HttpStatusCode.InternalServerError, "internal_error"),
        (HttpStatusCode.BadGateway, "bad_gateway"),
    ];

    private static readonly (string User, string Assistant)[] SupportPool =
    [
        ("Hi, where is my order #19120?", "Looking it up now — one moment."),
        ("My refund hasn't arrived yet.", "Refunds usually settle in 3-5 business days; let me check the status."),
        ("Can you help me change my shipping address?", "Sure — what's the order number?"),
        ("Do you offer international shipping?", "Yes — international shipping is available to 38 countries."),
        ("How do I reset my password?", "Use the 'Forgot password' link on the login page; a reset email arrives within a minute."),
        ("My package shows delivered but it isn't here.", "I'm sorry. I'll open a carrier trace and arrange a replacement."),
    ];

    private static readonly (string User, string Assistant)[] CodeReviewPool =
    [
        ("Review this pull request for null safety.", "Two potential NREs in PaymentProcessor.cs; suggest adding guard clauses."),
        ("Audit this method for SQL injection risk.", "Parameter `userId` is concatenated; switch to a parameterised query."),
        ("Is this implementation thread-safe?", "Field `_cache` is read without synchronisation; consider ConcurrentDictionary."),
        ("Comment on naming consistency.", "Mix of camelCase and snake_case in DTOs; align with project style guide."),
        ("Flag any obvious performance smells.", "Inner loop allocates a new List per iteration; hoist outside the loop."),
        ("Check error handling.", "Bare catch suppresses cancellation; rethrow OperationCanceledException."),
    ];

    private static readonly (string User, string Assistant)[] AnalyticsPool =
    [
        ("How many active users did we have last week?", "Active users in the last 7 full days: 17,902."),
        ("Top acquisition channels in May?", "organic 2,104, paid_search 1,388, referral 812, social 508."),
        ("DAU/MAU ratio for last month?", "DAU/MAU = 0.27 for April 2026."),
        ("Revenue split by region?", "EMEA 41%, NA 38%, APAC 17%, LATAM 4%."),
        ("Churn rate by plan tier?", "Free 6.1%, Pro 2.8%, Enterprise 0.7%."),
        ("Median order value last quarter?", "Median order value Q1 2026: $74.20."),
    ];

    private static readonly IReadOnlyDictionary<string, int[]> SuiteSchedule = new Dictionary<string, int[]>
    {
        ["customer-support-tone"] = [-13, -7, -1],
        ["customer-support-refunds"] = [-10, -3],
        ["code-review-bugs"] = [-12, -4],
        ["code-review-style"] = [-11, -5],
        ["data-analytics-queries"] = [-9, -2],
    };

    private readonly DemoSeedContext ctx;
    private readonly IAgentCall.CreateExisting agentCallExisting;
    private readonly ICompletion.Create completionFactory;
    private readonly IModelParameters.Create paramsFactory;
    private readonly ITestRun.CreateExisting testRunExisting;
    private readonly ITestRunGroup.CreateExisting testRunGroupExisting;
    private readonly ITestResult.CreateExisting testResultExisting;
    private readonly IRepository<IAgentCall> agentCallRepo;
    private readonly IRepository<ITestRunGroup> groupRepo;
    private readonly IRandom random;

    public StatisticsBackfillScenario(
        DemoSeedContext ctx,
        IAgentCall.CreateExisting agentCallExisting,
        ICompletion.Create completionFactory,
        IModelParameters.Create paramsFactory,
        ITestRun.CreateExisting testRunExisting,
        ITestRunGroup.CreateExisting testRunGroupExisting,
        ITestResult.CreateExisting testResultExisting,
        IRepository<IAgentCall> agentCallRepo,
        IRepository<ITestRunGroup> groupRepo,
        IRandom random)
    {
        this.ctx = ctx;
        this.agentCallExisting = agentCallExisting;
        this.completionFactory = completionFactory;
        this.paramsFactory = paramsFactory;
        this.testRunExisting = testRunExisting;
        this.testRunGroupExisting = testRunGroupExisting;
        this.testResultExisting = testResultExisting;
        this.agentCallRepo = agentCallRepo;
        this.groupRepo = groupRepo;
        this.random = random;
    }

    public int Order => 40;

    public async Task SeedAsync(CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var windowStart = now.AddDays(-WindowDays);

        var profiles = new[]
        {
            new BackfillProfile(
                ctx.RequireCustomerSupportAgent(),
                [new(ctx.RequireGpt4oEndpoint(), 0.70), new(ctx.RequireClaudeEndpoint(), 0.30)],
                SupportPool),
            new BackfillProfile(
                ctx.RequireCodeReviewAgent(),
                [new(ctx.RequireClaudeEndpoint(), 0.80), new(ctx.RequireGpt4oMiniEndpoint(), 0.20)],
                CodeReviewPool),
            new BackfillProfile(
                ctx.RequireDataAnalyticsAgent(),
                [new(ctx.RequireGpt4oEndpoint(), 0.60), new(ctx.RequireGpt4oMiniEndpoint(), 0.40)],
                AnalyticsPool),
        };

        var calls = new List<IAgentCall>();
        foreach (var profile in profiles)
        {
            CollectAgentCalls(profile, windowStart, now, calls);
        }

        await agentCallRepo.AddRangeAsync(calls, cancellationToken);

        await StaggerTestRunsAsync(now, cancellationToken);
    }

    private void CollectAgentCalls(
        BackfillProfile profile,
        DateTimeOffset windowStart,
        DateTimeOffset now,
        List<IAgentCall> calls)
    {
        for (int day = 0; day < WindowDays; day++)
        {
            var dayStart = windowStart.AddDays(day);
            int count = random.Int(MinCallsPerDay, MaxCallsPerDay);
            for (int i = 0; i < count; i++)
            {
                var createdAt = SampleTimestamp(dayStart);
                if (createdAt > now)
                {
                    continue;
                }

                var endpoint = PickWeighted(profile.EndpointMix);
                bool isError = random.Double() < ErrorRate;
                (string userText, string assistantText) = random.Any(profile.Pool);
                ulong inTok = (ulong)random.Int(200, 451);
                ulong outTok = (ulong)random.Int(40, 221);
                int latencyMs = random.Double() < LatencyTailRate
                    ? random.Int(1500, 3501)
                    : random.Int(400, 901);

                var systemMsg = profile.Agent.CreateSystemMessage();
                var userMsg = new UserMessage([Content.FromText(userText)]);
                var request = new Conversation([systemMsg, userMsg]);

                ICompletion? response = isError
                    ? null
                    : completionFactory(
                        new AssistantMessage([Content.FromText(assistantText)], []),
                        new TokenUsage(inTok, outTok),
                        TimeSpan.FromMilliseconds(latencyMs));

                (HttpStatusCode status, string? errorMessage, string? finishReason) = isError
                    ? BuildError()
                    : (HttpStatusCode.OK, (string?)null, "stop");

                var id = Guid.NewGuid();
                var call = agentCallExisting(
                    agent: profile.Agent,
                    endpoint: endpoint,
                    request: request,
                    response: response,
                    httpStatus: status,
                    finishReason: finishReason,
                    errorMessage: errorMessage,
                    modelParameters: paramsFactory(temperature: 0.3),
                    existing: new BackdatedData(id, createdAt, createdAt),
                    conversationId: null);

                calls.Add(call);
            }
        }
    }

    private (HttpStatusCode Status, string? ErrorMessage, string? FinishReason) BuildError()
    {
        var variant = random.Any(ErrorVariants);
        return (variant.Status, variant.Message, null);
    }

    private DateTimeOffset SampleTimestamp(DateTimeOffset dayStart)
    {
        int hour = SampleDiurnalHour();
        int minute = random.Int(0, 60);
        int second = random.Int(0, 60);
        return dayStart.AddHours(hour).AddMinutes(minute).AddSeconds(second);
    }

    private int SampleDiurnalHour()
    {
        int total = DiurnalWeights.Sum();
        int pick = random.Int(0, total);
        int acc = 0;
        for (int h = 0; h < DiurnalWeights.Length; h++)
        {
            acc += DiurnalWeights[h];
            if (pick < acc)
            {
                return h;
            }
        }
        return DiurnalWeights.Length - 1;
    }

    private IModelEndpoint PickWeighted(IReadOnlyList<EndpointWeight> mix)
    {
        double pick = random.Double();
        double acc = 0;
        foreach (var w in mix)
        {
            acc += w.Weight;
            if (pick <= acc)
            {
                return w.Endpoint;
            }
        }
        return mix[^1].Endpoint;
    }

    private async Task StaggerTestRunsAsync(DateTimeOffset now, CancellationToken cancellationToken)
    {
        var groupOrder = new List<ITestRunGroup>();
        var seenGroups = new HashSet<Guid>();
        foreach (var run in ctx.AllRuns)
        {
            if (seenGroups.Add(run.Group.Id))
            {
                groupOrder.Add(run.Group);
            }
        }

        var perSuiteIndex = new Dictionary<Guid, int>();
        foreach (var group in groupOrder)
        {
            string? suiteKey = ctx.SuitesByKey.FirstOrDefault(kv => kv.Value.Id == group.Suite.Id).Key;
            if (suiteKey is null || !SuiteSchedule.TryGetValue(suiteKey, out var offsets))
            {
                continue;
            }

            int idx = perSuiteIndex.GetValueOrDefault(group.Suite.Id);
            if (idx >= offsets.Length)
            {
                continue;
            }
            perSuiteIndex[group.Suite.Id] = idx + 1;

            var groupTime = now.AddDays(offsets[idx]);
            await BackdateGroupAsync(group, groupTime, cancellationToken);
        }
    }

    private async Task BackdateGroupAsync(
        ITestRunGroup group,
        DateTimeOffset groupTime,
        CancellationToken cancellationToken)
    {
        var fresh = await groupRepo.GetAsync(group.Id, cancellationToken);
        var runs = await fresh.GetTestRuns(cancellationToken);

        foreach (var run in runs)
        {
            foreach (var result in run.TestResults)
            {
                var backdatedResult = testResultExisting(
                    testCase: result.TestCase,
                    actualResponse: result.ActualResponse,
                    evaluations: result.Evaluations,
                    latency: result.Latency,
                    usage: result.Usage,
                    existing: new BackdatedData(result.Id, groupTime, result.UpdatedAt));
                await backdatedResult.UpdateAsync(cancellationToken);
            }

            var backdatedRun = testRunExisting(
                group: fresh,
                endpoint: run.Endpoint,
                status: run.Status,
                completedAt: groupTime.AddMinutes(5),
                testResults: run.TestResults,
                existing: new BackdatedData(run.Id, groupTime, run.UpdatedAt));
            await backdatedRun.UpdateAsync(cancellationToken);
        }

        var backdatedGroup = testRunGroupExisting(
            suite: fresh.Suite,
            status: fresh.Status,
            completedAt: groupTime.AddMinutes(5),
            existing: new BackdatedData(fresh.Id, groupTime, fresh.UpdatedAt));
        await backdatedGroup.UpdateAsync(cancellationToken);
    }

    private sealed record BackdatedData(Guid Id, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt) : IDomainEntityData;

    private sealed record EndpointWeight(IModelEndpoint Endpoint, double Weight);

    private sealed record BackfillProfile(
        IAgent Agent,
        IReadOnlyList<EndpointWeight> EndpointMix,
        (string User, string Assistant)[] Pool);
}
