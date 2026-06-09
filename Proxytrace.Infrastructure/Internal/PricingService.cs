using Proxytrace.Domain.ModelProvider;

namespace Proxytrace.Infrastructure.Internal;

internal sealed class PricingService : IPricingService
{
    private readonly AzureRetailPriceResolver azureResolver;
    private readonly LiteLlmCatalogResolver liteLlmResolver;

    public PricingService(AzureRetailPriceResolver azureResolver, LiteLlmCatalogResolver liteLlmResolver)
    {
        this.azureResolver = azureResolver;
        this.liteLlmResolver = liteLlmResolver;
    }

    public Task<ModelPrice> ResolveAsync(
        IModelProvider provider,
        DiscoveredModel model,
        AzureDeploymentType deploymentType = AzureDeploymentType.GlobalStandard,
        CancellationToken cancellationToken = default)
        => ProviderEndpoints.IsAzure(provider.Endpoint)
            ? azureResolver.ResolveAsync(model, deploymentType, cancellationToken)
            : liteLlmResolver.ResolveAsync(model, cancellationToken);
}
