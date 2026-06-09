using Proxytrace.Domain.ModelProvider;

namespace Proxytrace.Application.Pricing;

/// <summary>
/// Discovers a provider's models and upserts their endpoints with freshly resolved prices.
/// Used on provider create/reload and by the periodic <c>PriceRefreshService</c>.
/// </summary>
public interface IModelPriceRefresher
{
    /// <summary>
    /// Refreshes one provider: discovers its models, creates endpoints for new ones, and updates
    /// the price of existing ones. Best-effort — discovery/pricing failures leave endpoints intact.
    /// </summary>
    Task RefreshProviderAsync(IModelProvider provider, CancellationToken cancellationToken = default);

    /// <summary>Refreshes every configured provider.</summary>
    Task RefreshAllAsync(CancellationToken cancellationToken = default);
}
