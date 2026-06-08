using System.Threading.Channels;

namespace Proxytrace.Application.ErrorLog.Internal;

internal sealed class ErrorLogChannel : IErrorLogChannel
{
    private const int Capacity = 500;

    private readonly Channel<ErrorLogEntry> channel = Channel.CreateBounded<ErrorLogEntry>(
        new BoundedChannelOptions(Capacity)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false,
        });

    public bool TryWrite(ErrorLogEntry entry) => channel.Writer.TryWrite(entry);

    public IAsyncEnumerable<ErrorLogEntry> ReadAllAsync(CancellationToken cancellationToken)
        => channel.Reader.ReadAllAsync(cancellationToken);
}
