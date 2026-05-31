using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Project;

namespace Proxytrace.Proxy;

/// <summary>
/// Resolves a raw inbound bearer token (and optional project slug from the request path) to a
/// <see cref="ResolvedApiKey"/> on the proxy hot path. Accepts either a Proxytrace-issued
/// <see cref="Domain.ApiKey.IApiKey"/> (which carries its own project) or the provider's own
/// upstream <see cref="Domain.ModelProvider.IModelProvider.ApiKey"/> (which needs the project
/// slug from the path for attribution); the Proxytrace key wins if the same string matches both.
/// Implemented with a short-TTL cache so the proxy keeps authenticating during brief database
/// blips or while the main app runs migrations.
/// </summary>
public interface IApiKeyResolver
{
    /// <summary>
    /// Resolves the inbound credentials. <paramref name="projectSlug"/> is the project segment from
    /// the request path (e.g. <c>/{project}/openai/v1/…</c>), or <see langword="null"/> when the
    /// caller used the legacy <c>/openai/v1/…</c> form. It is required for the upstream-key path and,
    /// when supplied alongside a Proxytrace key, must match that key's project. Returns
    /// <see langword="null"/> when authentication or attribution fails.
    /// </summary>
    Task<ResolvedApiKey?> ResolveAsync(string rawKey, string? projectSlug, CancellationToken cancellationToken);
}

/// <summary>
/// Outcome of resolving an inbound bearer token on the proxy hot path. Carries the upstream
/// provider to forward to and the project to attribute the captured call to, independent of
/// which authentication path matched (a Proxytrace-issued <see cref="Domain.ApiKey.IApiKey"/>
/// or the provider's own upstream <see cref="IModelProvider.ApiKey"/>).
/// </summary>
/// <param name="Project">The project to attribute the captured call to.</param>
/// <param name="Provider">The upstream provider to forward to.</param>
/// <param name="ExpiresAt">
/// When the matched Proxytrace key expires, or <see langword="null"/> for keys that never expire
/// (and for the upstream-provider path). Used to clamp the resolver cache lifetime.
/// </param>
public sealed record ResolvedApiKey(IProject Project, IModelProvider Provider, DateTimeOffset? ExpiresAt = null);
