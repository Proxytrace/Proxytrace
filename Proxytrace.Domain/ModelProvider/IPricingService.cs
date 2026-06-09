namespace Proxytrace.Domain.ModelProvider;

/// <summary>
/// Resolves a model's price (EUR / 1M tokens) for a provider. Azure providers use the Azure Retail
/// Prices API (native EUR); all others use the LiteLLM catalog converted USD→EUR. Unresolved → nulls.
/// </summary>
public interface IPricingService
{
    Task<ModelPrice> ResolveAsync(
        IModelProvider provider,
        DiscoveredModel model,
        AzureDeploymentType deploymentType = AzureDeploymentType.GlobalStandard,
        CancellationToken cancellationToken = default);
}
