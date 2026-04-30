using System.Net;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Project;

namespace Trsr.Api.Services;

/// <summary>
/// FIFO queue for proxy ingestion jobs. Enqueueing is fast (a channel write); a background
/// worker processes jobs serially so that within-conversation order is preserved and
/// continuation merges are race-free.
/// </summary>
public interface IAgentCallIngestionQueue
{
    /// <summary>
    /// Enqueues a single ingestion job. Returns once the job has been accepted by the queue
    /// (does not wait for processing).
    /// </summary>
    ValueTask EnqueueAsync(
        IModelProvider provider,
        IProject project,
        string requestBody,
        string? responseBody,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        CancellationToken cancellationToken = default);
}
