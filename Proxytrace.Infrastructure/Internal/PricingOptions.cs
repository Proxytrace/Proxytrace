namespace Proxytrace.Infrastructure.Internal;

/// <summary>Pricing feed endpoints. Defaults are baked in; override via the "Pricing" config section.</summary>
public sealed class PricingOptions
{
    public string LiteLlmFeedUrl { get; init; } =
        "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
    public string AzureRetailApiUrl { get; init; } = "https://prices.azure.com/api/retail/prices";
    public string FxApiUrl { get; init; } = "https://api.frankfurter.app/latest";
}
