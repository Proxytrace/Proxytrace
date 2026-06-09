namespace Proxytrace.Domain.ModelProvider;

/// <summary>
/// Resolves a model's price (EUR / 1M tokens) for a provider from the LiteLLM catalog converted
/// USD→EUR. Azure providers prefer the catalog's <c>azure/&lt;model&gt;</c> entry. Unresolved → nulls.
/// </summary>
public interface IPricingService
{
    Task<ModelPrice> ResolveAsync(
        IModelProvider provider,
        DiscoveredModel model,
        CancellationToken cancellationToken = default);
}
