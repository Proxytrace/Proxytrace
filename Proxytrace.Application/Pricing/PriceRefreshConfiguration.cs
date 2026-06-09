namespace Proxytrace.Application.Pricing;

/// <summary>Settings for the periodic model-price refresh (bound from the "Pricing" config section).</summary>
public sealed record PriceRefreshConfiguration
{
    /// <summary>How often the background service re-resolves prices for every provider's models.</summary>
    public int RefreshIntervalHours { get; init; } = 1;
}
