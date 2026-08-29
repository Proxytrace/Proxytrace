using System.Net;
using Proxytrace.Domain;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Project;
using Proxytrace.Messaging;

namespace Proxytrace.Application.Ingestion.Internal;

/// <summary>
/// In-process ingestion: the shared core used both by the <see cref="AgentCallIngestionWorker"/>
/// (per stream envelope) and by same-process producers via <see cref="IIngestionExecutor"/>. Keeps
/// the provider/project re-hydration + processor dispatch in one place.
/// </summary>
internal sealed class IngestionExecutor : IIngestionExecutor
{
    private readonly IAgentCallProcessor processor;
    private readonly IRepository<IModelProvider> providerRepository;
    private readonly IRepository<IProject> projectRepository;

    /// <summary>
    /// Initializes a new instance of the <see cref="IngestionExecutor"/> class.
    /// </summary>
    public IngestionExecutor(
        IAgentCallProcessor processor,
        IRepository<IModelProvider> providerRepository,
        IRepository<IProject> projectRepository)
    {
        this.processor = processor;
        this.providerRepository = providerRepository;
        this.projectRepository = projectRepository;
    }

    /// <summary>
    /// Ingest asynchronously.
    /// </summary>
    public async Task IngestAsync(IngestMessage message, CancellationToken cancellationToken = default)
    {
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
            message.AgentName,
            message.BlockedByDetectorId,
            message.BlockedDetectorName,
            message.BlockedTriggerPattern,
            ConversationId: message.ConversationId,
            BlockedByBudget: message.BlockedByBudget,
            ApiKeyId: message.ApiKeyId);

        await processor.IngestAsync(job, cancellationToken);
    }
}
