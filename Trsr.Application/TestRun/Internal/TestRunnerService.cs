using System.Collections.Concurrent;
using System.Diagnostics;
using System.Threading.Channels;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Trsr.Application.Streaming;
using Trsr.Domain;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.TestCase;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestRunGroup;
using Trsr.Domain.TestSuite;

namespace Trsr.Application.TestRun.Internal;

internal class TestRunnerService : BackgroundService, ITestRunnerService
{
    private readonly ITestResult.CreateNew createTestResult;
    private readonly ITestRun.CreateNew createTestRun;
    private readonly ITestRunGroup.CreateNew createTestRunGroup;
    private readonly ITestRunRepository testRunRepository;
    private readonly ITestRunGroupRepository testRunGroupRepository;
    private readonly IRepository<ITestResult> testResultRepository;
    private readonly ITestResultBroadcaster broadcaster;
    private readonly ILogger<TestRunnerService> logger;
    private readonly ConcurrentDictionary<Guid, CancellationTokenSource> cancellationTokens = new();

    private readonly Channel<Guid> channel = Channel.CreateUnbounded<Guid>(
        new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false,
        });

    public TestRunnerService(
        ITestResult.CreateNew createTestResult,
        ITestRun.CreateNew createTestRun,
        ITestRunGroup.CreateNew createTestRunGroup,
        ITestRunRepository testRunRepository,
        ITestRunGroupRepository testRunGroupRepository,
        IRepository<ITestResult> testResultRepository,
        ITestResultBroadcaster broadcaster,
        ILogger<TestRunnerService> logger)
    {
        this.createTestResult = createTestResult;
        this.createTestRun = createTestRun;
        this.createTestRunGroup = createTestRunGroup;
        this.testRunRepository = testRunRepository;
        this.testRunGroupRepository = testRunGroupRepository;
        this.testResultRepository = testResultRepository;
        this.broadcaster = broadcaster;
        this.logger = logger;
    }

    public ChannelReader<Guid> Reader
        => channel.Reader;

    public void Enqueue(Guid runId)
        => channel.Writer.TryWrite(runId);

    public async Task<ITestRun> RunInForegroundAsync(
        ITestSuite suite,
        IModelEndpoint endpoint,
        CancellationToken cancellationToken = default)
    {
        ITestRunGroup group = createTestRunGroup(suite);
        group = await testRunGroupRepository.AddAsync(group, cancellationToken);

        ITestRun newRun = createTestRun(group, endpoint);
        newRun = await testRunRepository.AddAsync(newRun, cancellationToken);
        newRun = await ExecuteRunAsync(newRun, cancellationToken);
        return newRun;
    }

    public async Task<ITestRun> RunInBackgroundAsync(
        ITestSuite suite,
        IModelEndpoint endpoint,
        CancellationToken cancellationToken = default)
    {
        ITestRunGroup group = createTestRunGroup(suite);
        group = await testRunGroupRepository.AddAsync(group, cancellationToken);

        ITestRun newRun = createTestRun(group, endpoint);
        newRun = await testRunRepository.AddAsync(newRun, cancellationToken);
        await channel.Writer.WriteAsync(newRun.Id, cancellationToken);
        return newRun;
    }

    public async Task<ITestRunGroup> RunGroupInBackgroundAsync(
        ITestSuite suite,
        IReadOnlyList<IModelEndpoint> endpoints,
        CancellationToken cancellationToken = default)
    {
        ITestRunGroup group = createTestRunGroup(suite);
        group = await testRunGroupRepository.AddAsync(group, cancellationToken);

        foreach (var endpoint in endpoints)
        {
            ITestRun newRun = createTestRun(group, endpoint);
            newRun = await testRunRepository.AddAsync(newRun, cancellationToken);
            await channel.Writer.WriteAsync(newRun.Id, cancellationToken);
        }

        return group;
    }

    public async Task<ITestRunGroup> CancelAsync(ITestRunGroup group, CancellationToken cancellationToken = default)
    {
        var runs = await testRunRepository.GetByGroupAsync(group.Id, cancellationToken);

        foreach (var run in runs)
        {
            if (cancellationTokens.TryGetValue(run.Id, out CancellationTokenSource? cts))
                await cts.CancelAsync();
        }

        // Reload runs and mark any that didn't reach a terminal state as Cancelled.
        var reloaded = await testRunRepository.GetByGroupAsync(group.Id, cancellationToken);
        foreach (var run in reloaded.Where(r => !IsTerminal(r.Status)))
            await run.SetCancelled(cancellationToken);

        group = await testRunGroupRepository.GetAsync(group.Id, cancellationToken);
        if (!IsTerminal(group.Status))
        {
            group = await group.SetCancelled(cancellationToken);
            broadcaster.PublishGroupComplete(GroupRunCompleteEvent.Create(group));
        }

        return group;
    }

    private async Task<ITestRun> ExecuteRunAsync(
        ITestRun testRun,
        CancellationToken cancellationToken = default)
    {
        if (testRun.Status != TestRunStatus.Pending)
        {
            throw new InvalidOperationException($"Cannot execute test run {testRun.Id} because it is not in pending status.");
        }

        CancellationTokenSource cts = new CancellationTokenSource();
        cancellationTokens.TryAdd(testRun.Id, cts);
        cancellationToken = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, cts.Token).Token;

        try
        {
            testRun = await testRun.SetRunning(cancellationToken);
            await EnsureGroupRunningAsync(testRun.Group.Id, cancellationToken);

            var suite = testRun.Group.Suite;
            var groupId = testRun.Group.Id;
            foreach (ITestCase testCase in suite.TestCases)
            {
                broadcaster.Publish(new TestCaseStartedEvent(testRun.Id, groupId, testCase.Id));

                var stopwatch = Stopwatch.StartNew();
                AssistantMessage response = await suite.Agent.CompleteAsync(
                    testCase.Input,
                    testRun.Endpoint,
                    cancellationToken);
                TimeSpan elapsed = stopwatch.Elapsed;

                broadcaster.Publish(new InferenceDoneEvent(testRun.Id, groupId, testCase.Id));

                var testResult = createTestResult(testCase, response, [], elapsed);
                await testResultRepository.AddAsync(testResult, cancellationToken);

                foreach (IEvaluator evaluator in suite.Evaluators)
                {
                    IEvaluation? evaluation = await evaluator.EvaluateAsync(testResult, cancellationToken);
                    if (evaluation is null)
                        continue;
                    testResult = await testResult.AddEvaluationAsync(evaluation, cancellationToken);
                    broadcaster.Publish(new EvaluationArrivedEvent(
                        testRun.Id,
                        groupId,
                        testCase.Id,
                        new EvaluationEventData(
                            evaluator.Id,
                            evaluator.Kind,
                            TestResultArrivedEvent.GetEvaluatorName(evaluator),
                            evaluation.Score,
                            evaluation.Reasoning)));
                }

                testRun = await testRun.SetTestResult(testResult, cancellationToken);
                broadcaster.Publish(TestResultArrivedEvent.Create(testRun, testResult));
            }

            broadcaster.PublishComplete(RunCompleteEvent.Create(testRun));
            await UpdateGroupStatusOnRunCompleteAsync(testRun.Group.Id, cancellationToken);
            return testRun;
        }
        finally
        {
            cancellationTokens.TryRemove(testRun.Id, out _);
        }
    }

    private async Task EnsureGroupRunningAsync(Guid groupId, CancellationToken cancellationToken)
    {
        var group = await testRunGroupRepository.GetAsync(groupId, cancellationToken);
        if (group.Status == TestRunStatus.Pending)
            await group.SetRunning(cancellationToken);
    }

    private async Task UpdateGroupStatusOnRunCompleteAsync(Guid groupId, CancellationToken cancellationToken)
    {
        var group = await testRunGroupRepository.GetAsync(groupId, cancellationToken);
        if (IsTerminal(group.Status))
            return;

        var allRuns = await testRunRepository.GetByGroupAsync(groupId, cancellationToken);
        if (!allRuns.All(r => IsTerminal(r.Status)))
            return;

        bool anyFailed = allRuns.Any(r => r.Status is TestRunStatus.Failed or TestRunStatus.Cancelled);
        var updatedGroup = anyFailed
            ? await group.SetFailed(cancellationToken)
            : await group.SetCompleted(cancellationToken);

        broadcaster.PublishGroupComplete(GroupRunCompleteEvent.Create(updatedGroup));
    }

    private static bool IsTerminal(TestRunStatus status)
        => status is TestRunStatus.Completed or TestRunStatus.Failed or TestRunStatus.Cancelled;

    protected override async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        try
        {
            await foreach (Guid runId in channel.Reader.ReadAllAsync(cancellationToken))
            {
                try
                {
                    ITestRun? testRun = await testRunRepository.FindAsync(runId, cancellationToken);
                    if (testRun != null)
                    {
                        await ExecuteRunAsync(testRun, cancellationToken);
                    }
                    else
                    {
                        logger.LogWarning("Test run with ID {RunId} not found in repository", runId);
                    }
                }
                catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
                {
                    // user-initiated cancellation — not an error
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Failed to execute test run {RunId}", runId);
                }
            }
        }
        catch (OperationCanceledException)
        {
            // graceful shutdown
        }
    }
}
