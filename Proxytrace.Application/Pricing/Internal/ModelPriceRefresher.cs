using Microsoft.Extensions.Logging;
using Proxytrace.Domain;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.ModelProvider;

namespace Proxytrace.Application.Pricing.Internal;

internal sealed class ModelPriceRefresher : IModelPriceRefresher
{
    private readonly IRepository<IModelProvider> providerRepository;
    private readonly IModelEndpointRepository endpointRepository;
    private readonly IModelEndpoint.CreateNew createEndpoint;
    private readonly IModelEndpoint.CreateExisting updateEndpoint;
    private readonly ILogger<ModelPriceRefresher> logger;

    public ModelPriceRefresher(
        IRepository<IModelProvider> providerRepository,
        IModelEndpointRepository endpointRepository,
        IModelEndpoint.CreateNew createEndpoint,
        IModelEndpoint.CreateExisting updateEndpoint,
        ILogger<ModelPriceRefresher> logger)
    {
        this.providerRepository = providerRepository;
        this.endpointRepository = endpointRepository;
        this.createEndpoint = createEndpoint;
        this.updateEndpoint = updateEndpoint;
        this.logger = logger;
    }

    public async Task RefreshProviderAsync(IModelProvider provider, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<IModelEndpoint> existing = await endpointRepository.GetByProviderAsync(provider.Id, cancellationToken);

        IReadOnlyList<PricedModel> discovered;
        try
        {
            discovered = await provider.CreateClient().GetModelsAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            // Best-effort: discovery/pricing failure leaves the provider's endpoints untouched.
            logger.LogWarning(ex, "Model discovery failed for provider {ProviderId}", provider.Id);
            return;
        }

        foreach (PricedModel pm in discovered)
        {
            IModelEndpoint? existingEndpoint = existing.FirstOrDefault(
                e => string.Equals(e.Model.Name, pm.Model.Name, StringComparison.OrdinalIgnoreCase));

            if (existingEndpoint is not null)
            {
                // Always refresh the price of an existing endpoint from the resolved value.
                IModelEndpoint updated = updateEndpoint(
                    existingEndpoint.Model, existingEndpoint.Provider,
                    pm.Price.InputTokenCost, pm.Price.OutputTokenCost, existingEndpoint);
                await endpointRepository.UpdateAsync(updated, cancellationToken);
            }
            else
            {
                IModelEndpoint endpoint = createEndpoint(pm.Model, provider, pm.Price.InputTokenCost, pm.Price.OutputTokenCost);
                await endpointRepository.AddAsync(endpoint, cancellationToken);
            }
        }
    }

    public async Task RefreshAllAsync(CancellationToken cancellationToken = default)
    {
        IReadOnlyList<IModelProvider> providers = await providerRepository.GetAllAsync(cancellationToken);
        foreach (IModelProvider provider in providers)
        {
            await RefreshProviderAsync(provider, cancellationToken);
        }
    }
}
