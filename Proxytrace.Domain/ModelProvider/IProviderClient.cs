namespace Proxytrace.Domain.ModelProvider;

public interface IProviderClient
{
    public delegate IProviderClient Factory(IModelProvider provider);

    Task<bool> VerifyConnectionAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Discovers the provider's models and resolves each one's price. For Azure providers only the
    /// deployed models are returned (never the full upstream model list).
    /// </summary>
    Task<IReadOnlyList<PricedModel>> GetModelsAsync(CancellationToken cancellationToken = default);
}