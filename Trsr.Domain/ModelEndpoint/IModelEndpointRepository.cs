namespace Trsr.Domain.ModelEndpoint;

/// <summary>
/// Repository for <see cref="IModelEndpoint"/> entities with additional lookup operations.
/// </summary>
public interface IModelEndpointRepository : IRepository<IModelEndpoint>
{
    /// <summary>
    /// Finds a model endpoint by model name and provider name, or returns null if not found.
    /// </summary>
    Task<IModelEndpoint> GetOrCreateAsync(
        string modelName,
        string providerName,
        CancellationToken cancellationToken = default);
}

