using System.Runtime.CompilerServices;
using System.Threading.Channels;

namespace Proxytrace.Api;

/// <summary>
/// Helpers for Server-Sent Events endpoints: a comment heartbeat that detects dead clients on quiet
/// streams (a half-open TCP connection never raises <c>RequestAborted</c>, so without a periodic
/// write the subscription would leak forever), and an idle-aware channel reader that surfaces those
/// heartbeat ticks alongside real events.
/// </summary>
internal static class SseWriter
{
    private static readonly TimeSpan HeartbeatInterval = TimeSpan.FromSeconds(20);

    /// <summary>Writes an SSE comment line, used as a keep-alive heartbeat.</summary>
    public static async Task WriteHeartbeatAsync(HttpResponse response, CancellationToken cancellationToken)
    {
        await response.WriteAsync(":\n\n", cancellationToken);
        await response.Body.FlushAsync(cancellationToken);
    }

    /// <summary>
    /// Yields each event from <paramref name="reader"/> as it arrives, plus a <c>null</c> sentinel
    /// every <see cref="HeartbeatInterval"/> of inactivity so the caller can emit a keep-alive. Ends
    /// when the channel completes or the token cancels (client disconnect).
    /// </summary>
    public static async IAsyncEnumerable<T?> ReadWithHeartbeatAsync<T>(
        ChannelReader<T> reader,
        [EnumeratorCancellation] CancellationToken cancellationToken)
        where T : class
    {
        while (true)
        {
            Task<bool> readTask = reader.WaitToReadAsync(cancellationToken).AsTask();
            Task completed = await Task.WhenAny(readTask, Task.Delay(HeartbeatInterval, cancellationToken));

            if (completed != readTask)
            {
                // Idle interval elapsed before any event — emit a heartbeat tick.
                yield return null;
                continue;
            }

            bool hasData;
            try
            {
                hasData = await readTask;
            }
            catch (OperationCanceledException)
            {
                yield break;
            }

            if (!hasData)
            {
                yield break;
            }

            while (reader.TryRead(out T? item))
            {
                yield return item;
            }
        }
    }
}
