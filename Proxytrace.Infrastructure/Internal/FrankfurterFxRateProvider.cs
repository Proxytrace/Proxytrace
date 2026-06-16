using System.Text.Json;
using Proxytrace.Common.Async;
using Proxytrace.Domain.ModelProvider;

namespace Proxytrace.Infrastructure.Internal;

/// <summary>USD→EUR via the free, no-key Frankfurter (ECB) API. Cached for the calendar day.</summary>
internal sealed class FrankfurterFxRateProvider : IFxRateProvider
{
    private const string CacheGateKey = "fx-rate:usd-eur";

    private readonly HttpClient http;
    private readonly PricingOptions options;
    private readonly IAsyncLock asyncLock;
    private decimal? cachedRate;
    private DateOnly cachedOn;

    public FrankfurterFxRateProvider(HttpClient http, PricingOptions options, IAsyncLock asyncLock)
    {
        this.http = http;
        this.options = options;
        this.asyncLock = asyncLock;
    }

    public async Task<decimal?> GetUsdToEurAsync(CancellationToken cancellationToken = default)
    {
        DateOnly today = DateOnly.FromDateTime(DateTimeOffset.UtcNow.UtcDateTime);
        if (cachedRate is not null && cachedOn == today)
            return cachedRate;

        using IDisposable sync = await asyncLock.LockAsync(CacheGateKey, cancellationToken);

        if (cachedRate is not null && cachedOn == today)
            return cachedRate;

        decimal? rate = await FetchAsync(cancellationToken);
        if (rate is not null)
        {
            cachedRate = rate;
            cachedOn = today;
        }
        return rate;
    }

    private async Task<decimal?> FetchAsync(CancellationToken cancellationToken)
    {
        try
        {
            string url = $"{options.FxApiUrl}?from=USD&to=EUR";
            using HttpResponseMessage response = await http.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode)
                return null;

            await using Stream stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using JsonDocument doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            if (doc.RootElement.TryGetProperty("rates", out JsonElement rates)
                && rates.TryGetProperty("EUR", out JsonElement eur)
                && eur.ValueKind == JsonValueKind.Number)
            {
                return eur.GetDecimal();
            }
            return null;
        }
        catch
        {
            return null;
        }
    }
}
