using Proxytrace.Application.Playground.Internal;

namespace Proxytrace.Application.Playground;

public interface IPlaygroundService
{
    IAsyncEnumerable<PlaygroundEvent> CompleteStreamAsync(
        PlaygroundCompleteRequest request,
        CancellationToken cancellationToken);
}
