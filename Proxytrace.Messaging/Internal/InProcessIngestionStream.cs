using System.Threading.Channels;

namespace Proxytrace.Messaging.Internal;

/// <summary>
/// In-memory single-process transport. Preserves the original in-process channel behaviour for
/// the test suite and local single-process runs. Acknowledgement is a no-op because nothing is
/// redelivered.
/// </summary>
internal sealed class InProcessIngestionStream : IIngestionStream
{
    private readonly Channel<IngestEnvelope> channel = Channel.CreateUnbounded<IngestEnvelope>(
        new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false,
        });

    public async Task PublishAsync(IngestMessage message, CancellationToken cancellationToken = default)
        => await channel.Writer.WriteAsync(
            new IngestEnvelope(Guid.NewGuid().ToString("N"), message),
            cancellationToken);

    public IAsyncEnumerable<IngestEnvelope> ConsumeAsync(CancellationToken cancellationToken = default)
        => channel.Reader.ReadAllAsync(cancellationToken);

    public Task AckAsync(string messageId, CancellationToken cancellationToken = default)
        => Task.CompletedTask;
}
