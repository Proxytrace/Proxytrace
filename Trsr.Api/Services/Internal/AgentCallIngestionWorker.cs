using Microsoft.Extensions.Hosting;

namespace Trsr.Api.Services.Internal;

/// <summary>
/// Background worker that drains the <see cref="AgentCallIngestionQueue"/> serially. Running a
/// single consumer guarantees that ingestion order matches enqueue order, which is required for
/// tool-call continuations to find the prior agent call.
/// </summary>
internal sealed class AgentCallIngestionWorker : BackgroundService
{
    private readonly AgentCallIngestionQueue queue;
    private readonly Func<IAgentCallIngestionService> ingestionFactory;
    private readonly ILogger<AgentCallIngestionWorker> logger;

    public AgentCallIngestionWorker(
        AgentCallIngestionQueue queue,
        Func<IAgentCallIngestionService> ingestionFactory,
        ILogger<AgentCallIngestionWorker> logger)
    {
        this.queue = queue;
        this.ingestionFactory = ingestionFactory;
        this.logger = logger;
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
        => RunAsync(stoppingToken);

    public async Task RunAsync(CancellationToken cancellationToken)
    {
        try
        {
            await foreach (var job in queue.Reader.ReadAllAsync(cancellationToken))
            {
                await ProcessAsync(job, cancellationToken);
            }
        }
        catch (OperationCanceledException)
        {
            // graceful shutdown
        }
    }

    private async Task ProcessAsync(IngestJob job, CancellationToken cancellationToken)
    {
        try
        {
            var ingestion = ingestionFactory();
            await ingestion.IngestAsync(
                provider: job.Provider,
                project: job.Project,
                requestBody: job.RequestBody,
                responseBody: job.ResponseBody,
                duration: job.Duration,
                httpStatus: job.HttpStatus,
                cancellationToken: cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to process ingestion job (status={HttpStatus})", job.HttpStatus);
        }
    }
}
