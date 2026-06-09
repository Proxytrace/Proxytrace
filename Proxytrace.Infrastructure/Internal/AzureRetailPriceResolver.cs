using System.Text.Json;
using Proxytrace.Domain.ModelProvider;

namespace Proxytrace.Infrastructure.Internal;

/// <summary>
/// Resolves Azure OpenAI model prices from the public, unauthenticated Azure Retail Prices API in
/// EUR (no FX needed). Matches by base model + direction + deployment-type fragment in the meter name.
/// </summary>
internal sealed class AzureRetailPriceResolver
{
    private readonly HttpClient http;
    private readonly PricingOptions options;

    public AzureRetailPriceResolver(HttpClient http, PricingOptions options)
    {
        this.http = http;
        this.options = options;
    }

    public async Task<ModelPrice> ResolveAsync(
        DiscoveredModel model, AzureDeploymentType deploymentType, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<Meter> meters = await FetchMetersAsync(cancellationToken);
        string modelToken = model.PricingModelName.Replace('-', ' ');

        decimal? input = FindPrice(meters, modelToken, deploymentType, isInput: true);
        decimal? output = FindPrice(meters, modelToken, deploymentType, isInput: false);
        return new ModelPrice(input, output);
    }

    private static decimal? FindPrice(IReadOnlyList<Meter> meters, string modelToken, AzureDeploymentType type, bool isInput)
    {
        foreach (Meter m in meters)
        {
            string name = m.MeterName;
            if (name.IndexOf(modelToken, StringComparison.OrdinalIgnoreCase) < 0)
                continue;
            if (isInput != IsInputMeter(name))
                continue;
            if (!MatchesDeploymentType(name, type))
                continue;
            return Normalize(m.RetailPrice, m.UnitOfMeasure);
        }
        return null;
    }

    private static bool IsInputMeter(string meterName) =>
        meterName.Contains("Inp", StringComparison.OrdinalIgnoreCase);

    private static bool MatchesDeploymentType(string meterName, AzureDeploymentType type)
    {
        bool isGlobal = meterName.Contains("glbl", StringComparison.OrdinalIgnoreCase)
            || meterName.Contains("Global", StringComparison.OrdinalIgnoreCase);
        bool isDataZone = meterName.Contains("Data Zone", StringComparison.OrdinalIgnoreCase);
        return type switch
        {
            AzureDeploymentType.GlobalStandard => isGlobal,
            AzureDeploymentType.DataZoneStandard => isDataZone,
            AzureDeploymentType.Standard => !isGlobal && !isDataZone,
            _ => false,
        };
    }

    /// <summary>Azure quotes per-1K tokens; normalize to per-1M.</summary>
    private static decimal Normalize(decimal price, string unitOfMeasure) =>
        unitOfMeasure.StartsWith("1K", StringComparison.OrdinalIgnoreCase) ? price * 1000m : price * 1_000_000m;

    private async Task<IReadOnlyList<Meter>> FetchMetersAsync(CancellationToken cancellationToken)
    {
        var meters = new List<Meter>();
        try
        {
            string url = $"{options.AzureRetailApiUrl}?currencyCode='EUR'&$filter={Uri.EscapeDataString("serviceName eq 'Cognitive Services'")}";
            using HttpResponseMessage response = await http.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode)
                return meters;

            await using Stream stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using JsonDocument doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            if (doc.RootElement.TryGetProperty("Items", out JsonElement items) && items.ValueKind == JsonValueKind.Array)
            {
                foreach (JsonElement item in items.EnumerateArray())
                {
                    string? meterName = item.TryGetProperty("meterName", out JsonElement mn) ? mn.GetString() : null;
                    string? unit = item.TryGetProperty("unitOfMeasure", out JsonElement uom) ? uom.GetString() : null;
                    if (meterName is null || unit is null)
                        continue;
                    if (!item.TryGetProperty("retailPrice", out JsonElement rp) || rp.ValueKind != JsonValueKind.Number)
                        continue;
                    meters.Add(new Meter(meterName, unit, rp.GetDecimal()));
                }
            }
        }
        catch
        {
            // fail-soft: network/parse errors return empty list → ModelPrice.Unknown
        }
        return meters;
    }

    private readonly record struct Meter(string MeterName, string UnitOfMeasure, decimal RetailPrice);
}
