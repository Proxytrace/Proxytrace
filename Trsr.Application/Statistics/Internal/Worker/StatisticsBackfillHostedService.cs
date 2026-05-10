using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Trsr.Domain;
using Trsr.Domain.Events;
using Trsr.Domain.TestRun;

namespace Trsr.Application.Statistics.Internal.Worker;

internal class StatisticsBackfillHostedService : IHostedService
{
    private readonly IRepository<ITestRun> testRuns;
    private readonly IEnumerable<IStatsProjector> projectors;
    private readonly ILogger<StatisticsBackfillHostedService> logger;

    private CancellationTokenSource? cts;
    private Task? backfillTask;

    public StatisticsBackfillHostedService(
        IRepository<ITestRun> testRuns,
        IEnumerable<IStatsProjector> projectors,
        ILogger<StatisticsBackfillHostedService> logger)
    {
        this.testRuns = testRuns;
        this.projectors = projectors;
        this.logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        backfillTask = Task.Run(() => RunAsync(cts.Token), cts.Token);
        return Task.CompletedTask;
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        if (cts is not null)
        {
            await cts.CancelAsync();
        }

        if (backfillTask is not null)
        {
            try
            {
                await backfillTask.WaitAsync(cancellationToken);
            }
            catch (OperationCanceledException) { }
        }
    }

    private async Task RunAsync(CancellationToken cancellationToken)
    {
        IStatsProjector[] testRunProjectors = projectors
            .Where(p => p.EntityType == typeof(ITestRun))
            .ToArray();

        if (testRunProjectors.Length == 0)
        {
            return;
        }

        try
        {
            IReadOnlyList<ITestRun> runs = await testRuns.GetAllAsync(cancellationToken);
            int finalized = 0;

            foreach (ITestRun run in runs)
            {
                if (cancellationToken.IsCancellationRequested)
                {
                    return;
                }

                if (run.Status is not (TestRunStatus.Completed or TestRunStatus.Failed or TestRunStatus.Cancelled))
                {
                    continue;
                }

                foreach (IStatsProjector projector in testRunProjectors)
                {
                    try
                    {
                        await projector.ProjectAsync(run.Id, EntityChangeType.Updated, cancellationToken);
                    }
                    catch (Exception ex)
                    {
                        logger.LogError(ex, "Backfill projector {Projector} failed for run {RunId}", projector.GetType().Name, run.Id);
                    }
                }

                finalized++;
            }

            logger.LogInformation("Statistics backfill scanned {Total} runs, projected {Finalized} finalized.", runs.Count, finalized);
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            logger.LogError(ex, "Statistics backfill failed");
        }
    }
}
