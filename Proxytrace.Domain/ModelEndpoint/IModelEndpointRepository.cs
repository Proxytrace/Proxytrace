using Proxytrace.Domain.ModelProvider;

namespace Proxytrace.Domain.ModelEndpoint;

/// <summary>
/// Repository for <see cref="IModelEndpoint"/> entities with additional lookup operations.
/// </summary>
public interface IModelEndpointRepository : IArchivableRepository<IModelEndpoint>
{
    /// <summary>
    /// Finds a model endpoint by model name and provider name, or returns null if not found.
    /// </summary>
    Task<IModelEndpoint> GetOrCreateAsync(
        string modelName,
        IModelProvider provider,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns all model endpoints belonging to the given provider.
    /// </summary>
    Task<IReadOnlyList<IModelEndpoint>> GetByProviderAsync(
        Guid providerId,
        CancellationToken cancellationToken = default);
}

