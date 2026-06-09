using Proxytrace.Domain.Model;
using Proxytrace.Domain.ModelProvider;

namespace Proxytrace.Proxy;

/// <summary>
/// Reconstituting a <see cref="IModelProvider"/> domain entity (which happens when the proxy
/// resolves an API key and walks the ApiKey → Project → ModelEndpoint → ModelProvider graph)
/// requires an <see cref="IProviderClient.Factory"/> in its constructor. The proxy only forwards
/// HTTP and never calls <see cref="IModelProvider.CreateClient"/>, so this stub satisfies the
/// dependency and throws if it is ever actually invoked.
/// </summary>
internal sealed class UnusedProviderClient : IProviderClient
{
    public Task<bool> VerifyConnectionAsync(CancellationToken cancellationToken = default)
        => throw new NotSupportedException("Provider client operations are not available in the ingestion proxy.");

    public Task<IReadOnlyList<IModel>> GetModelsAsync(CancellationToken cancellationToken = default)
        => throw new NotSupportedException("Provider client operations are not available in the ingestion proxy.");

    public Task<IReadOnlyList<DiscoveredModel>> DiscoverModelsAsync(CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<DiscoveredModel>>([]);
}
