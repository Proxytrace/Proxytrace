namespace Proxytrace.Domain.ApiKey;

/// <summary>
/// Repository for <see cref="IApiKey"/>
/// </summary>
public interface IApiKeyRepository : IRepository<IApiKey>
{
    /// <summary>
    /// Tries to find an API key by its key value. Returns the API key if found, or <see langword="null"/> if not found.
    /// </summary>
    Task<IApiKey?> FindByKeyAsync(string key, CancellationToken cancellationToken = default);
}