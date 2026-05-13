using Trsr.Domain.Agent;
using Trsr.Domain.Completion;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Infrastructure.Internal;

internal sealed class KioskModelClient : IModelClient
{
    private const string Message = "Kiosk mode: outbound model calls are disabled.";

    public KioskModelClient()
    {
    }

    public KioskModelClient(IAgent agent, IModelEndpoint? customEndpoint, bool skipIngestion)
    {
    }

    public Task<ICompletion> CompleteAsync(
        Conversation conversation,
        ModelOptions? options = null,
        IReadOnlyDictionary<string, string>? promptVariables = null,
        CancellationToken cancellationToken = default)
        => throw new InvalidOperationException(Message);

    public Task<TOutput?> CompleteAsync<TOutput>(
        Conversation conversation,
        ModelOptions? options = null,
        IReadOnlyDictionary<string, string>? promptVariables = null,
        CancellationToken cancellationToken = default)
        => throw new InvalidOperationException(Message);

    public async IAsyncEnumerable<ModelStreamUpdate> StreamAsync(
        SystemMessage systemMessage,
        Conversation conversation,
        ModelOptions? options = null,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        await Task.CompletedTask;
        throw new InvalidOperationException(Message);
#pragma warning disable CS0162
        yield break;
#pragma warning restore CS0162
    }
}
