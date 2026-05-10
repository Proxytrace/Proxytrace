using Trsr.Application.Playground.Internal;

namespace Trsr.Application.Playground;

public interface IPlaygroundService
{
    IAsyncEnumerable<PlaygroundEvent> CompleteStreamAsync(
        PlaygroundCompleteRequest request,
        CancellationToken cancellationToken);
}
