namespace Proxytrace.Domain.ModelProvider;

/// <summary>Supplies a current USD→EUR conversion rate. Returns null when unavailable.</summary>
public interface IFxRateProvider
{
    Task<decimal?> GetUsdToEurAsync(CancellationToken cancellationToken = default);
}
