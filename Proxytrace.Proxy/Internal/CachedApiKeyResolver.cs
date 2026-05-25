using System.Collections.Concurrent;
using Proxytrace.Domain.ApiKey;

namespace Proxytrace.Proxy;

internal sealed class CachedApiKeyResolver : IApiKeyResolver
{
    private readonly IApiKeyRepository repository;
    private readonly TimeSpan ttl;
    private readonly ConcurrentDictionary<string, CacheEntry> cache = new();

    public CachedApiKeyResolver(IApiKeyRepository repository, TimeSpan ttl)
    {
        this.repository = repository;
        this.ttl = ttl;
    }

    public async Task<IApiKey?> ResolveAsync(string rawKey, CancellationToken cancellationToken)
    {
        if (cache.TryGetValue(rawKey, out CacheEntry? entry) && entry.ExpiresAt > DateTimeOffset.UtcNow)
        {
            return entry.ApiKey;
        }

        IApiKey? apiKey = await repository.FindByKeyAsync(rawKey, cancellationToken);

        // Only cache positive resolutions so an outage can't pin a key to "unknown", and so the
        // last-known-good mapping keeps the proxy serving while the database is briefly unreachable.
        if (apiKey is not null)
        {
            cache[rawKey] = new CacheEntry(apiKey, DateTimeOffset.UtcNow.Add(ttl));
        }

        return apiKey;
    }

    private sealed record CacheEntry(IApiKey ApiKey, DateTimeOffset ExpiresAt);
}
