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
            if (!IsUsablePrice(pm.Price))
            {
                // Best-effort: a non-positive or inverted discovered price violates the endpoint's
                // own invariants and would throw during activation — which, since this runs inside
                // setup, would 500 the whole completion. Skip that model instead of bricking setup.
                logger.LogWarning(
                    "Skipping model {Model} from provider {ProviderId}: invalid discovered price (in={Input}, out={Output})",
                    pm.Model.Name, provider.Id, pm.Price.InputTokenCost, pm.Price.OutputTokenCost);
                continue;
            }

            IModelEndpoint? existingEndpoint = existing.FirstOrDefault(
                e => string.Equals(e.Model.Name, pm.Model.Name, StringComparison.OrdinalIgnoreCase));

            if (existingEndpoint is not null)
            {
                // Always refresh the price of an existing endpoint from the resolved value.
                IModelEndpoint updated = updateEndpoint(
                    existingEndpoint.Model, existingEndpoint.Provider,
                    pm.Price.InputTokenCost, pm.Price.OutputTokenCost, pm.Price.CachedInputTokenCost, existingEndpoint);
                await endpointRepository.UpdateAsync(updated, cancellationToken);
            }
            else
            {
                IModelEndpoint endpoint = createEndpoint(
                    pm.Model, provider, pm.Price.InputTokenCost, pm.Price.OutputTokenCost, pm.Price.CachedInputTokenCost);
                await endpointRepository.AddAsync(endpoint, cancellationToken);
            }
        }
    }

    /// <summary>
    /// Whether a discovered price can back a model endpoint. Unknown (null) costs are allowed — they
    /// create an unpriced endpoint — but a present cost must satisfy the same invariants the endpoint
    /// enforces (each positive, input ≤ output); otherwise activation validation throws.
    /// </summary>
    private static bool IsUsablePrice(ModelPrice price)
    {
        if (price.InputTokenCost is { } input && input <= 0) return false;
        if (price.OutputTokenCost is { } output && output <= 0) return false;
        if (price.CachedInputTokenCost is { } cached && cached <= 0) return false;
        if (price.InputTokenCost is { } i && price.OutputTokenCost is { } o && i > o) return false;
        if (price.CachedInputTokenCost is { } c && price.InputTokenCost is { } ci && c > ci) return false;
        return true;
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
