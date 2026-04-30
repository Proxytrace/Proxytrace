using System.Net;
using System.Threading.Channels;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Project;

namespace Trsr.Api.Services.Internal;

internal sealed class AgentCallIngestionQueue : IAgentCallIngestionQueue
{
    private readonly Channel<IngestJob> channel = Channel.CreateUnbounded<IngestJob>(
        new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false,
        });

    public ChannelReader<IngestJob> Reader => channel.Reader;

    public ValueTask EnqueueAsync(
        IModelProvider provider,
        IProject project,
        string requestBody,
        string? responseBody,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        CancellationToken cancellationToken = default)
        => channel.Writer.WriteAsync(
            new IngestJob(provider, project, requestBody, responseBody, duration, httpStatus),
            cancellationToken);

    public void Complete()
        => channel.Writer.TryComplete();
}
