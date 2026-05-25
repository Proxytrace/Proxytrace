using Proxytrace.Domain.ApiKey;

namespace Proxytrace.Proxy;

/// <summary>
/// Resolves a raw Proxytrace API key to its <see cref="IApiKey"/> on the proxy hot path.
/// Implemented with a short-TTL cache so the proxy keeps authenticating during brief database
/// blips or while the main app runs migrations.
/// </summary>
public interface IApiKeyResolver
{
    Task<IApiKey?> ResolveAsync(string rawKey, CancellationToken cancellationToken);
}
