using System.Diagnostics;
using System.Threading.Channels;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Trsr.Domain;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.TestCase;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestSuite;

namespace Trsr.Application.TestRun.Internal;

internal class TestRunnerService : BackgroundService, ITestRunnerService
{
    private readonly ITestResult.CreateNew createTestResult;
    private readonly ITestRun.CreateNew createTestRun;
    private readonly ITestRunRepository testRunRepository;
    private readonly IRepository<ITestResult> testResultRepository;
    private readonly ILogger<TestRunnerService> logger;
    
    private readonly Channel<Guid> channel = Channel.CreateUnbounded<Guid>(
        new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false,
        });

    public TestRunnerService(
        ITestResult.CreateNew createTestResult,
        ITestRun.CreateNew createTestRun,
        ITestRunRepository testRunRepository,
        IRepository<ITestResult> testResultRepository,
        ILogger<TestRunnerService> logger)
    {
        this.createTestResult = createTestResult;
        this.createTestRun = createTestRun;
        this.testRunRepository = testRunRepository;
        this.testResultRepository = testResultRepository;
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
        ITestRun newRun = createTestRun(suite, endpoint);
        newRun = await testRunRepository.AddAsync(newRun, cancellationToken);
        newRun = await ExecuteRunAsync(newRun, cancellationToken);
        return newRun;
    }

    public async Task<ITestRun> RunInBackgroundAsync(
        ITestSuite suite,
        IModelEndpoint endpoint,
        CancellationToken cancellationToken = default)
    {
        ITestRun newRun = createTestRun(suite, endpoint);
        newRun = await testRunRepository.AddAsync(newRun, cancellationToken);
        await channel.Writer.WriteAsync(newRun.Id, cancellationToken);
        return newRun;
    }

    private async Task<ITestRun> ExecuteRunAsync(
        ITestRun testRun, 
        CancellationToken cancellationToken = default)
    {
        if(testRun.Status != TestRunStatus.Pending)
        {
            throw new InvalidOperationException($"Cannot execute test run {testRun.Id} because it is not in pending status.");
        }
        
        await testRun.SetRunning(cancellationToken);
        var suite = testRun.Suite;
        foreach (ITestCase testCase in suite.TestCases)
        {
            var stopwatch = Stopwatch.StartNew();
            AssistantMessage response = await suite.Agent.CompleteAsync(
                testCase.Input,
                testRun.Endpoint,
                cancellationToken);
            TimeSpan elapsed = stopwatch.Elapsed;
            
            Evaluation evaluation = await suite
                .Evaluator
                .EvaluateAsync(testCase.ExpectedOutput, response, cancellationToken);

            var testResult = createTestResult(testCase, response, evaluation, elapsed);
            await testResultRepository.AddAsync(testResult, cancellationToken);
            testRun = await testRun.SetTestResult(testResult, cancellationToken);
        }

        return testRun;
    }
    
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
