using System.Threading.Channels;

namespace Trsr.Api.Services.Internal;

internal sealed class TestRunQueue : ITestRunQueue
{
    private readonly Channel<Guid> channel = Channel.CreateUnbounded<Guid>(
        new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false,
        });

    public ChannelReader<Guid> Reader => channel.Reader;

    public void Enqueue(Guid runId)
        => channel.Writer.TryWrite(runId);
}
