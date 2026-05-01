using Microsoft.Extensions.Hosting;
using Trsr.Domain;
using Trsr.Domain.TestRun;

namespace Trsr.Api.Services.Internal;

internal sealed class TestRunBackgroundService : BackgroundService
{
    private readonly TestRunQueue queue;
    private readonly Func<ITestRunExecutor> executorFactory;
    private readonly IRepository<ITestRun> repository;
    private readonly ILogger<TestRunBackgroundService> logger;

    public TestRunBackgroundService(
        TestRunQueue queue,
        Func<ITestRunExecutor> executorFactory,
        IRepository<ITestRun> repository,
        ILogger<TestRunBackgroundService> logger)
    {
        this.queue = queue;
        this.executorFactory = executorFactory;
        this.repository = repository;
        this.logger = logger;
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
        => RunAsync(stoppingToken);

    public async Task RunAsync(CancellationToken cancellationToken)
    {
        try
        {
            await foreach (Guid runId in queue.Reader.ReadAllAsync(cancellationToken))
            {
                ITestRun? testRun = await repository.FindAsync(runId, cancellationToken);
                if (testRun != null)
                {
                    await ProcessAsync(testRun, cancellationToken); 
                }
                else
                {
                    logger.LogWarning("Test run with ID {RunId} not found in repository", runId);
                }
                
            }
        }
        catch (OperationCanceledException)
        {
            // graceful shutdown
        }
    }

    private async Task ProcessAsync(ITestRun testRun, CancellationToken cancellationToken)
    {
        try
        {
            var executor = executorFactory();
            await executor.ExecuteRunAsync(testRun, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to execute test run {RunId}", testRun.Id);
        }
    }
}
