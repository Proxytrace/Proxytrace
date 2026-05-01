using System.Diagnostics;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.TestCase;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestSuite;

namespace Trsr.Api.Services.Internal;

internal class TestRunnerService : ITestRunnerService, ITestRunExecutor
{
    private readonly ITestResult.CreateNew createTestResult;
    private readonly ITestRun.CreateNew createTestRun;
    private readonly ITestRunRepository testRunRepository;
    private readonly ITestRunQueue testRunQueue;
    private readonly ILogger<TestRunnerService> logger;

    public TestRunnerService(
        ITestResult.CreateNew createTestResult,
        ITestRun.CreateNew createTestRun,
        ITestRunRepository testRunRepository,
        ITestRunQueue testRunQueue,
        ILogger<TestRunnerService> logger)
    {
        this.createTestResult = createTestResult;
        this.createTestRun = createTestRun;
        this.testRunRepository = testRunRepository;
        this.testRunQueue = testRunQueue;
        this.logger = logger;
    }

    public async Task<ITestRun> RunAsync(
        ITestSuite suite, 
        IModelEndpoint endpoint, 
        CancellationToken cancellationToken = default)
    {
        ITestRun newRun = createTestRun(suite, endpoint);
        newRun = await testRunRepository.AddAsync(newRun, cancellationToken);
        await ExecuteRunAsync(newRun, cancellationToken);
        return newRun;
    }

    public async Task<ITestRun> StartAsync(
        ITestSuite suite,
        IModelEndpoint endpoint,
        CancellationToken cancellationToken = default)
    {
        ITestRun newRun = createTestRun(suite, endpoint);
        newRun = await testRunRepository.AddAsync(newRun, cancellationToken);
        testRunQueue.Enqueue(newRun.Id);
        return newRun;
    }

    public async Task<ITestRun> ExecuteRunAsync(
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
            testRun = await testRun.SetTestResult(testResult, cancellationToken);
        }

        return testRun;
    }
}
