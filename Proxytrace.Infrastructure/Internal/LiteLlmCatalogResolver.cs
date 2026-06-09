using System.Text.Json;
using Proxytrace.Domain.ModelProvider;

namespace Proxytrace.Infrastructure.Internal;

/// <summary>
/// Resolves prices from the LiteLLM catalog (USD per token), converting to EUR / 1M tokens via the
/// FX provider. The catalog is fetched once and cached in memory. Used for non-Azure providers.
/// </summary>
internal sealed class LiteLlmCatalogResolver
{
    private readonly HttpClient http;
    private readonly PricingOptions options;
    private readonly IFxRateProvider fxRateProvider;
    private readonly SemaphoreSlim gate = new(1, 1);
    private IReadOnlyDictionary<string, (decimal? Input, decimal? Output)>? cache;

    public LiteLlmCatalogResolver(HttpClient http, PricingOptions options, IFxRateProvider fxRateProvider)
    {
        this.http = http;
        this.options = options;
        this.fxRateProvider = fxRateProvider;
    }

    public async Task<ModelPrice> ResolveAsync(DiscoveredModel model, CancellationToken cancellationToken = default)
    {
        IReadOnlyDictionary<string, (decimal? Input, decimal? Output)> catalog = await GetCatalogAsync(cancellationToken);
        if (!catalog.TryGetValue(model.PricingModelName, out var entry))
            return ModelPrice.Unknown;

        decimal? fx = await fxRateProvider.GetUsdToEurAsync(cancellationToken);
        if (fx is null)
            return ModelPrice.Unknown;

        return new ModelPrice(ToEurPer1M(entry.Input, fx.Value), ToEurPer1M(entry.Output, fx.Value));
    }

    private static decimal? ToEurPer1M(decimal? usdPerToken, decimal fx) =>
        usdPerToken is null ? null : usdPerToken.Value * 1_000_000m * fx;

    private async Task<IReadOnlyDictionary<string, (decimal?, decimal?)>> GetCatalogAsync(CancellationToken cancellationToken)
    {
        if (cache is not null)
            return cache;

        await gate.WaitAsync(cancellationToken);
        try
        {
            if (cache is not null)
                return cache;
            cache = await FetchAsync(cancellationToken);
            return cache;
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<IReadOnlyDictionary<string, (decimal?, decimal?)>> FetchAsync(CancellationToken cancellationToken)
    {
        var result = new Dictionary<string, (decimal?, decimal?)>(StringComparer.OrdinalIgnoreCase);
        try
        {
            using HttpResponseMessage response = await http.GetAsync(options.LiteLlmFeedUrl, cancellationToken);
            if (!response.IsSuccessStatusCode)
                return result;

            await using Stream stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using JsonDocument doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            foreach (JsonProperty prop in doc.RootElement.EnumerateObject())
            {
                if (prop.Value.ValueKind != JsonValueKind.Object)
                    continue;
                result[prop.Name] = (
                    ReadDecimal(prop.Value, "input_cost_per_token"),
                    ReadDecimal(prop.Value, "output_cost_per_token"));
            }
        }
        catch
        {
            // fail-soft: empty catalog → callers get ModelPrice.Unknown
        }
        return result;
    }

    private static decimal? ReadDecimal(JsonElement obj, string name) =>
        obj.TryGetProperty(name, out JsonElement el) && el.ValueKind == JsonValueKind.Number
            ? el.GetDecimal()
            : null;
}
