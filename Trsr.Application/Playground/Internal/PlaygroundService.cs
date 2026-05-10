namespace Trsr.Application.Playground.Internal;

internal sealed class PlaygroundService : IPlaygroundService
{
    public IAsyncEnumerable<PlaygroundEvent> CompleteStreamAsync(
        PlaygroundCompleteRequest request,
        CancellationToken cancellationToken)
    {
        throw new NotImplementedException();
    }
}
