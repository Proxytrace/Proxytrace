namespace Proxytrace.Domain.ModelProvider;

/// <summary>
/// Repository for <see cref="IModelProvider"/> with upstream-key lookup used by the proxy
/// when callers authenticate with the provider's own API key instead of a Proxytrace-issued one.
/// </summary>
public interface IModelProviderRepository : IRepository<IModelProvider>
{
    /// <summary>
    /// Returns the provider whose upstream <see cref="IModelProvider.ApiKey"/> matches
    /// <paramref name="apiKey"/>, or <see langword="null"/> if none exists.
    /// </summary>
    Task<IModelProvider?> FindByApiKeyAsync(string apiKey, CancellationToken cancellationToken = default);
}
