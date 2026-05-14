using System.Collections.Concurrent;
using System.Threading.Channels;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Trsr.Application.Optimization;
using Trsr.Application.Streaming;
using Trsr.Common.Async;
using Trsr.Domain;
using Trsr.Domain.Completion;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Evaluator;
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
    private readonly IOptimizerService optimizer;
    private readonly IAsyncLock asyncLock;
    private readonly ILogger<TestRunnerService> logger;
    private readonly TestRunnerConfiguration configuration;
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
        IOptimizerService optimizer,
        IAsyncLock asyncLock,
        ILogger<TestRunnerService> logger,
        TestRunnerConfiguration configuration)
    {
        this.createTestResult = createTestResult;
        this.createTestRun = createTestRun;
        this.createTestRunGroup = createTestRunGroup;
        this.testRunRepository = testRunRepository;
        this.testRunGroupRepository = testRunGroupRepository;
        this.testResultRepository = testResultRepository;
        this.broadcaster = broadcaster;
        this.optimizer = optimizer;
        this.asyncLock = asyncLock;
        this.logger = logger;
        this.configuration = configuration;
    }

    public async Task<ITestRunGroup> RunInForegroundAsync(
        ITestSuite suite,
        IReadOnlyList<IModelEndpoint> endpoints,
        CancellationToken cancellationToken = default)
    {
        ITestRunGroup group = await CreateGroup(suite, endpoints, cancellationToken);
        return await ExecuteGroupAsync(group, cancellationToken);
    }

    public async Task<ITestRunGroup> RunInBackgroundAsync(
        ITestSuite suite,
        IReadOnlyList<IModelEndpoint> endpoints,
        CancellationToken cancellationToken = default)
    {
        ITestRunGroup group = await CreateGroup(suite, endpoints, cancellationToken);
        await channel.Writer.WriteAsync(group.Id, cancellationToken);
        return group;
    }

    private async Task<ITestRunGroup> CreateGroup(
        ITestSuite suite,
        IReadOnlyList<IModelEndpoint> endpoints,
        CancellationToken cancellationToken)
    {
        ITestRunGroup group = createTestRunGroup(suite);
        group = await testRunGroupRepository.AddAsync(group, cancellationToken);

        foreach (var endpoint in endpoints)
        {
            ITestRun newRun = createTestRun(group, endpoint);
            await testRunRepository.AddAsync(newRun, cancellationToken);
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

    private async Task<ITestRunGroup> ExecuteGroupAsync(
        ITestRunGroup group,
        CancellationToken cancellationToken = default)
    {
        if (group.Status != TestRunStatus.Pending)
        {
            throw new InvalidOperationException($"Cannot execute test run {group.Id} because it is not in pending status.");
        }
        await group.SetRunning(cancellationToken);

        CancellationTokenSource cts = new CancellationTokenSource();
        cancellationTokens.TryAdd(group.Id, cts);
        cancellationToken = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, cts.Token).Token;

        try
        {
            var testRuns = await testRunRepository.GetByGroupAsync(group.Id, cancellationToken);
            
            var parallelOptions = new ParallelOptions
            {
                MaxDegreeOfParallelism = configuration.MaxDegreeOfParallelism,
                CancellationToken = cancellationToken
            };
            
            await Parallel.ForEachAsync(
                testRuns,
                parallelOptions, 
                async (testRun, ct) => await RunTestRun(testRun, ct));
            
            group = await group.ReloadAsync(cancellationToken);
            group = await group.SetCompleted(cancellationToken);
            broadcaster.PublishGroupComplete(GroupRunCompleteEvent.Create(group));

            await optimizer.EnqueueAsync(group, cancellationToken);
            return group;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Test run group {GroupId} failed", group.Id);
            try
            {
                group = await group.ReloadAsync(CancellationToken.None);
                if (!IsTerminal(group.Status))
                {
                    group = await group.SetFailed(CancellationToken.None);
                }
                broadcaster.PublishGroupComplete(GroupRunCompleteEvent.Create(group));
            }
            catch (Exception broadcastEx)
            {
                logger.LogError(broadcastEx, "Failed to mark test run group {GroupId} as Failed", group.Id);
            }
            return group;
        }
        finally
        {
            cancellationTokens.TryRemove(group.Id, out _);
        }
    }

    private async Task RunTestRun(
        ITestRun testRun,
        CancellationToken cancellationToken)
    {
        var parallelOptions = new ParallelOptions
        {
            MaxDegreeOfParallelism = configuration.MaxDegreeOfParallelism,
            CancellationToken = cancellationToken
        };

        await Parallel.ForEachAsync(
            testRun.Group.Suite.TestCases,
            parallelOptions,
            async (testCase, ct) => await RunTestCase(testCase, testRun, ct));

        testRun = await testRun.ReloadAsync(cancellationToken);
        broadcaster.PublishComplete(RunCompleteEvent.Create(testRun));
    }

    private async Task RunTestCase(
        ITestCase testCase, 
        ITestRun testRun, 
        CancellationToken cancellationToken)
    {
        broadcaster.Publish(new TestCaseStartedEvent(testRun.Id, testRun.Group.Id, testCase.Id));

        IModelClient client = testRun.Group.Suite.Agent.CreateClient(
            customEndpoint: testRun.Endpoint,
            skipIngestion: true);
        ICompletion completion = await client.CompleteAsync(
            testCase.Input,
            cancellationToken: cancellationToken);

        broadcaster.Publish(new InferenceDoneEvent(testRun.Id, testRun.Group.Id, testCase.Id));
        
        var testResult = createTestResult(testCase, completion, []);
        await testResultRepository.AddAsync(testResult, cancellationToken);

        var run = testRun;
        var parallelOptions = new ParallelOptions
        {
            MaxDegreeOfParallelism = configuration.MaxDegreeOfParallelism,
            CancellationToken = cancellationToken
        };
        
        await Parallel.ForEachAsync(testRun.Group.Suite.Evaluators, parallelOptions,
            async (evaluator, ct) => await RunEvaluator(evaluator, testResult, run, ct));
        
        using var sync = await asyncLock.LockAsync(testRun.Id, cancellationToken);
        testRun = await testRun.ReloadAsync(cancellationToken);
        testRun = await testRun.SetTestResult(testResult, cancellationToken);

        broadcaster.Publish(TestResultArrivedEvent.Create(testRun, testResult));
    }

    private async Task RunEvaluator(
        IEvaluator evaluator,
        ITestResult testResult,
        ITestRun testRun,
        CancellationToken cancellationToken)
    {
        IEvaluation? evaluation;
        try
        {
            evaluation = await evaluator.EvaluateAsync(testResult, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogWarning(
                ex,
                "Evaluator {EvaluatorId} ({EvaluatorKind}) failed for test result {TestResultId}",
                evaluator.Id,
                evaluator.Kind,
                testResult.Id);
            return;
        }

        if (evaluation is null)
        {
            return;
        }

        using var sync = await asyncLock.LockAsync(testResult.Id, cancellationToken);
        testResult = await testResult.ReloadAsync(cancellationToken);
        await testResult.AddEvaluationAsync(evaluation, cancellationToken);
        broadcaster.Publish(new EvaluationArrivedEvent(
            testRun.Id,
            testRun.Group.Id,
            testResult.TestCase.Id,
            new EvaluationEventData(
                evaluator.Id,
                evaluator.Kind,
                evaluator.Name,
                evaluation.Score,
                evaluation.Reasoning)));
    }

    private static bool IsTerminal(TestRunStatus status)
        => status is TestRunStatus.Completed or TestRunStatus.Failed or TestRunStatus.Cancelled;

    protected override async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        try
        {
            await foreach (Guid groupId in channel.Reader.ReadAllAsync(cancellationToken))
            {
                try
                {
                    ITestRunGroup? group = await testRunGroupRepository.FindAsync(groupId, cancellationToken);
                    if (group != null)
                    {
                        await ExecuteGroupAsync(group, cancellationToken);
                    }
                    else
                    {
                        logger.LogWarning("Test run group with ID {RunId} not found in repository", groupId);
                    }
                }
                catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
                {
                    // user-initiated cancellation — not an error
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Failed to execute test run {RunId}", groupId);
                }
            }
        }
        catch (OperationCanceledException)
        {
            // graceful shutdown
        }
    }
}
