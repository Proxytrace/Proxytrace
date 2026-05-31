using Microsoft.Extensions.Caching.Memory;
using Proxytrace.Common.Text;
using Proxytrace.Domain.ApiKey;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Project;

namespace Proxytrace.Proxy.Internal;

internal sealed class CachedApiKeyResolver : IApiKeyResolver
{
    private readonly IApiKeyRepository apiKeys;
    private readonly IModelProviderRepository providers;
    private readonly IProjectRepository projects;
    private readonly IMemoryCache cache;
    private readonly TimeSpan ttl;

    public CachedApiKeyResolver(
        IApiKeyRepository apiKeys,
        IModelProviderRepository providers,
        IProjectRepository projects,
        IMemoryCache cache,
        TimeSpan ttl)
    {
        this.apiKeys = apiKeys;
        this.providers = providers;
        this.projects = projects;
        this.cache = cache;
        this.ttl = ttl;
    }

    public async Task<ResolvedApiKey?> ResolveAsync(string rawKey, string? projectSlug, CancellationToken cancellationToken)
    {
        var cacheKey = CacheKey(rawKey, projectSlug);
        if (cache.TryGetValue(cacheKey, out ResolvedApiKey? cached) && cached is not null)
        {
            return cached;
        }

        ResolvedApiKey? resolved = await ResolveFromStoreAsync(rawKey, projectSlug, cancellationToken);

        // Only cache positive resolutions so an outage can't pin a key to "unknown", and so the
        // last-known-good mapping keeps the proxy serving while the database is briefly unreachable.
        if (resolved is not null)
        {
            TimeSpan effectiveTtl = ClampTtl(resolved.ExpiresAt);
            if (effectiveTtl > TimeSpan.Zero)
            {
                cache.Set(cacheKey, resolved, effectiveTtl);
            }
        }

        return resolved;
    }

    private async Task<ResolvedApiKey?> ResolveFromStoreAsync(string rawKey, string? projectSlug, CancellationToken cancellationToken)
    {
        // Proxytrace-issued key path wins on collisions. The key already carries its project, so the
        // path slug is optional — but when supplied it must agree, to avoid silently mis-attributing.
        IApiKey? apiKey = await apiKeys.FindByKeyAsync(rawKey, cancellationToken);
        if (apiKey is not null)
        {
            // A short-lived key past its expiry authenticates no longer; treat as not found (→ 401).
            if (apiKey.ExpiresAt is { } expiresAt && expiresAt < DateTimeOffset.UtcNow)
            {
                return null;
            }

            return !string.IsNullOrEmpty(projectSlug) && apiKey.Project.Name.ToSlug() != projectSlug
                ? null
                : new ResolvedApiKey(apiKey.Project, apiKey.Provider, apiKey.ExpiresAt);
        }

        // Upstream-provider-key path: caller authenticated with the provider's own credentials. The
        // bearer identifies only the provider, so the project must come from the request path.
        IModelProvider? provider = await providers.FindByApiKeyAsync(rawKey, cancellationToken);
        if (provider is null || string.IsNullOrEmpty(projectSlug))
        {
            return null;
        }

        IProject? project = await projects.FindBySlugAsync(projectSlug, cancellationToken);
        if (project is null)
        {
            return null;
        }

        return new ResolvedApiKey(project, provider);
    }

    // Never serve a short-lived key from cache past its own lifetime: clamp the configured TTL to the
    // remaining time before expiry. Keys that never expire keep the configured TTL.
    private TimeSpan ClampTtl(DateTimeOffset? expiresAt)
    {
        if (expiresAt is not { } expiry)
        {
            return ttl;
        }

        TimeSpan remaining = expiry - DateTimeOffset.UtcNow;
        return remaining < ttl ? remaining : ttl;
    }

    private static string CacheKey(string rawKey, string? projectSlug)
        => $"apikey:{projectSlug}:{rawKey}";
}
