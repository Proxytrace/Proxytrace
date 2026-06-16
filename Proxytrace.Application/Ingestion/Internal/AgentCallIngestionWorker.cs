using System.Net;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Proxytrace.Domain;
using Proxytrace.Domain.Exceptions;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Project;
using Proxytrace.Messaging;

namespace Proxytrace.Application.Ingestion.Internal;

/// <summary>
/// Consumer side of ingestion. Reads captured calls off the <see cref="IIngestionStream"/>
/// (Redis Streams in the split deployment, in-memory otherwise), re-hydrates the
/// <c>IModelProvider</c>/<c>IProject</c> referenced by id, and hands the work to
/// <see cref="IAgentCallProcessor"/>. Replaces the producer half of the old in-process ingestor,
/// which now lives in the proxy service.
/// </summary>
internal sealed class AgentCallIngestionWorker : BackgroundService
{
    private readonly IIngestionStream stream;
    private readonly IAgentCallProcessor processor;
    private readonly IRepository<IModelProvider> providerRepository;
    private readonly IRepository<IProject> projectRepository;
    private readonly ITraceQuotaGuard quotaGuard;
    private readonly ILogger<AgentCallIngestionWorker> logger;

    // Cap redelivery of a retryable-but-deterministically-failing message so it can't loop forever
    // and block the pending list. The consumer is single-threaded, so this plain dictionary (keyed
    // by transport message id) is accessed sequentially and only retains currently-failing ids.
    private const int MaxRetryableAttempts = 5;
    private readonly Dictionary<string, int> failedAttempts = new();

    public AgentCallIngestionWorker(
        IIngestionStream stream,
        IAgentCallProcessor processor,
        IRepository<IModelProvider> providerRepository,
        IRepository<IProject> projectRepository,
        ITraceQuotaGuard quotaGuard,
        ILogger<AgentCallIngestionWorker> logger)
    {
        this.stream = stream;
        this.processor = processor;
        this.providerRepository = providerRepository;
        this.projectRepository = projectRepository;
        this.quotaGuard = quotaGuard;
        this.logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        // Outer loop keeps the consumer alive across transport blips (e.g. a brief Redis outage):
        // ConsumeAsync may throw mid-stream, so we log, back off, and re-enter rather than letting
        // the BackgroundService fault permanently.
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                await foreach (IngestEnvelope envelope in stream.ConsumeAsync(cancellationToken))
                {
                    await HandleAsync(envelope, cancellationToken);
                }
            }
            catch (OperationCanceledException)
            {
                return; // graceful shutdown
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Ingestion consumer loop failed; retrying shortly");
                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    return;
                }
            }
        }
    }

    private async Task HandleAsync(IngestEnvelope envelope, CancellationToken cancellationToken)
    {
        try
        {
            await ProcessAsync(envelope.Message, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Shutting down — leave the entry pending so it is reclaimed and reprocessed later.
            throw;
        }
        catch (EntityNotFoundException ex)
        {
            // Poison: the referenced provider/project no longer exists. Unrecoverable — ack to drop
            // it rather than redeliver forever.
            logger.LogWarning(ex, "Dropping ingestion envelope {MessageId}: referenced entity missing", envelope.MessageId);
            await AckAndForgetAsync(envelope.MessageId, cancellationToken);
            return;
        }
        catch (Exception ex)
        {
            // The processor swallows its own poison failures and rethrows only retryable storage
            // errors (transient DB outage, unique-index race). Leave the entry UNacked so Redis
            // redelivers it — but cap attempts so a deterministically-failing message can't loop.
            var attempts = failedAttempts.GetValueOrDefault(envelope.MessageId) + 1;
            if (attempts >= MaxRetryableAttempts)
            {
                logger.LogError(ex, "Dropping ingestion envelope {MessageId} after {Attempts} failed attempts", envelope.MessageId, attempts);
                await AckAndForgetAsync(envelope.MessageId, cancellationToken);
            }
            else
            {
                failedAttempts[envelope.MessageId] = attempts;
                logger.LogWarning(ex, "Retryable failure on ingestion envelope {MessageId} (attempt {Attempts}); leaving unacked for redelivery", envelope.MessageId, attempts);
            }
            return;
        }

        // Success — acknowledge and forget any prior attempt count.
        await AckAndForgetAsync(envelope.MessageId, cancellationToken);
    }

    private async Task AckAndForgetAsync(string messageId, CancellationToken cancellationToken)
    {
        failedAttempts.Remove(messageId);
        await stream.AckAsync(messageId, cancellationToken);
    }

    private async Task ProcessAsync(IngestMessage message, CancellationToken cancellationToken)
    {
        // Once the licensed monthly trace quota is reached, drop further captures rather than
        // persisting them. The message is still acked by the caller to avoid redelivery loops.
        if (quotaGuard.IsCurrentMonthOverQuota)
        {
            logger.LogWarning("Monthly trace quota exceeded; dropping captured call for project {ProjectId}", message.ProjectId);
            return;
        }

        IModelProvider provider = await providerRepository.GetAsync(message.ProviderId, cancellationToken);
        IProject project = await projectRepository.GetAsync(message.ProjectId, cancellationToken);

        var job = new IngestJob(
            provider,
            project,
            message.RequestBody,
            message.ResponseBody,
            TimeSpan.FromMilliseconds(message.DurationMs),
            (HttpStatusCode)message.HttpStatus,
            message.SessionId,
            message.AgentName);

        await processor.IngestAsync(job, cancellationToken);
    }
}
