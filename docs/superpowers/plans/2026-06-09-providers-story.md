# Providers Story Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Project rules:** Before writing/modifying any **backend test**, invoke the `test` skill (`.claude/skills/test/SKILL.md`) — mandatory per CLAUDE.md. Before writing/modifying any **e2e test**, invoke the `create-e2e-test` skill. Before any **frontend** code, read `frontend/DESIGN.md` + `frontend/BEST_PRACTICES.md`. Nullable `!` suppression is forbidden.

**Goal:** Auto-load a provider's models with correct costs on create (Azure via Azure Retail Prices API in EUR; others via LiteLLM USD→EUR), show the upstream endpoint only when non-default, and replace the Models/API-keys tabs with stacked sections.

**Architecture:** A new `IPricingService` (interface in Domain, impl in Infrastructure) selects a resolver by whether the provider endpoint is Azure (`azure.com` host): `AzureRetailPriceResolver` (native EUR) or `LiteLlmCatalogResolver` (USD × FX). Model discovery gets a richer `DiscoverModelsAsync` returning `(Name, PricingModelName)` that reuses the existing Azure deployment fetch and never falls back to the full `/models` list for Azure. No domain entity / DB changes.

**Tech Stack:** .NET (C#, Autofac DI, MSTest + NSubstitute + AwesomeAssertions), React + TypeScript + TanStack Query + Tailwind, Vitest, Playwright.

---

## File Structure

**Backend — new (Domain, `Proxytrace.Domain/ModelProvider/`):**
- `DiscoveredModel.cs` — `record DiscoveredModel(string Name, string PricingModelName)`
- `AzureDeploymentType.cs` — `enum AzureDeploymentType { GlobalStandard, DataZoneStandard, Standard }`
- `ModelPrice.cs` — `record ModelPrice(decimal? InputTokenCost, decimal? OutputTokenCost)` (EUR / 1M tokens)
- `IPricingService.cs` — resolver entry point
- `IFxRateProvider.cs` — USD→EUR
- `ProviderEndpoints.cs` — `static bool IsAzure(Uri)`

**Backend — new (Infrastructure, `Proxytrace.Infrastructure/Internal/`):**
- `PricingOptions.cs` — feed URLs (defaults baked in)
- `PricingService.cs` — selects resolver by `ProviderEndpoints.IsAzure`
- `AzureRetailPriceResolver.cs`
- `LiteLlmCatalogResolver.cs`
- `FrankfurterFxRateProvider.cs`

**Backend — modify:**
- `Proxytrace.Domain/ModelProvider/IProviderClient.cs` — add `DiscoverModelsAsync`
- `Proxytrace.Infrastructure/Internal/ProviderClient.cs` — implement it; Azure = deployments only, no fallback; capture base model
- `Proxytrace.Proxy/Controllers/UnusedProviderClient.cs` — implement new interface member (stub)
- `Proxytrace.Infrastructure/Module.cs` — register pricing services + options + HttpClient
- `Proxytrace.Api/Controllers/ModelProvidersController.cs` — auto-load on create; `reload` endpoint; available-models via `DiscoverModelsAsync`
- `Proxytrace.Api/appsettings.json` + `appsettings.example.json` — `Pricing` section

**Backend — tests (`Proxytrace.Infrastructure.Tests/`, `Proxytrace.Api.Tests/`):**
- `LiteLlmCatalogResolverTests.cs`, `AzureRetailPriceResolverTests.cs`, `PricingServiceTests.cs`, `FrankfurterFxRateProviderTests.cs`
- extend `ProviderClientTests.cs`
- extend the providers controller API test

**Frontend — modify (`frontend/src/features/providers/`):**
- `providerMeta.ts` (+ `providerMeta.spec.ts`)
- `components/ProviderDetailHeader.tsx`
- `components/ProviderDetail.tsx`
- rename `components/ModelsTab.tsx` → `components/ModelsSection.tsx`, `components/KeysTab.tsx` → `components/KeysSection.tsx`
- `Providers.tsx`
- `hooks/useProviderMutations.ts`, `hooks/useProviderQueries.ts`
- `frontend/src/api/providers.ts`

**Docs:** `docs/frontend.md`, `manual/guide/` providers page.

---

## Task 1: Provider endpoint helpers + DiscoveredModel (Domain)

**Files:**
- Create: `Proxytrace.Domain/ModelProvider/ProviderEndpoints.cs`
- Create: `Proxytrace.Domain/ModelProvider/DiscoveredModel.cs`
- Create: `Proxytrace.Domain/ModelProvider/AzureDeploymentType.cs`
- Create: `Proxytrace.Domain/ModelProvider/ModelPrice.cs`
- Test: `Proxytrace.Domain.Tests/ProviderEndpointsTests.cs`

- [ ] **Step 1: Invoke the `test` skill** (mandatory before backend tests). Follow its harness conventions for the test below.

- [ ] **Step 2: Write the failing test**

```csharp
using AwesomeAssertions;
using Proxytrace.Domain.ModelProvider;

namespace Proxytrace.Domain.Tests;

[TestClass]
public sealed class ProviderEndpointsTests
{
    [DataTestMethod]
    [DataRow("https://my-resource.openai.azure.com/", true)]
    [DataRow("https://eastus.api.cognitive.microsoft.azure.com/", true)]
    [DataRow("https://api.openai.com/v1", false)]
    [DataRow("https://api.anthropic.com/v1", false)]
    public void IsAzure_DetectsByHost(string endpoint, bool expected)
    {
        ProviderEndpoints.IsAzure(new Uri(endpoint)).Should().Be(expected);
    }
}
```

- [ ] **Step 3: Run it, verify it fails**

Run: `dotnet test Proxytrace.Domain.Tests --filter ProviderEndpointsTests`
Expected: FAIL (compile error — `ProviderEndpoints` not defined).

- [ ] **Step 4: Create the four types**

`ProviderEndpoints.cs`:
```csharp
namespace Proxytrace.Domain.ModelProvider;

/// <summary>Runtime classification of a provider by its endpoint, without changing the entity.</summary>
public static class ProviderEndpoints
{
    /// <summary>True when the endpoint host indicates an Azure OpenAI resource.</summary>
    public static bool IsAzure(Uri endpoint) =>
        endpoint.Host.Contains("azure.com", StringComparison.OrdinalIgnoreCase);
}
```

`DiscoveredModel.cs`:
```csharp
namespace Proxytrace.Domain.ModelProvider;

/// <summary>
/// A model surfaced by upstream discovery. <paramref name="Name"/> is what the proxy/endpoint
/// uses (for Azure: the deployment id). <paramref name="PricingModelName"/> is the base model used
/// for catalog/retail price lookup (for Azure: the deployment's underlying model; else == Name).
/// </summary>
public record DiscoveredModel(string Name, string PricingModelName);
```

`AzureDeploymentType.cs`:
```csharp
namespace Proxytrace.Domain.ModelProvider;

/// <summary>Azure OpenAI deployment SKU; affects retail price. Cannot be auto-detected with an
/// api-key, so it is supplied at request time.</summary>
public enum AzureDeploymentType
{
    GlobalStandard = 0,
    DataZoneStandard = 1,
    Standard = 2,
}
```

`ModelPrice.cs`:
```csharp
namespace Proxytrace.Domain.ModelProvider;

/// <summary>Resolved per-model price in EUR per 1M tokens; nulls when unresolved.</summary>
public record ModelPrice(decimal? InputTokenCost, decimal? OutputTokenCost)
{
    public static readonly ModelPrice Unknown = new(null, null);
}
```

- [ ] **Step 5: Run it, verify it passes**

Run: `dotnet test Proxytrace.Domain.Tests --filter ProviderEndpointsTests`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add Proxytrace.Domain/ModelProvider/ProviderEndpoints.cs Proxytrace.Domain/ModelProvider/DiscoveredModel.cs Proxytrace.Domain/ModelProvider/AzureDeploymentType.cs Proxytrace.Domain/ModelProvider/ModelPrice.cs Proxytrace.Domain.Tests/ProviderEndpointsTests.cs
git commit -m "feat: provider endpoint classification + pricing value types"
```

---

## Task 2: Pricing + FX interfaces (Domain)

**Files:**
- Create: `Proxytrace.Domain/ModelProvider/IFxRateProvider.cs`
- Create: `Proxytrace.Domain/ModelProvider/IPricingService.cs`

No test (interfaces only; covered by implementation tasks).

- [ ] **Step 1: Create `IFxRateProvider.cs`**

```csharp
namespace Proxytrace.Domain.ModelProvider;

/// <summary>Supplies a current USD→EUR conversion rate. Returns null when unavailable.</summary>
public interface IFxRateProvider
{
    Task<decimal?> GetUsdToEurAsync(CancellationToken cancellationToken = default);
}
```

- [ ] **Step 2: Create `IPricingService.cs`**

```csharp
namespace Proxytrace.Domain.ModelProvider;

/// <summary>
/// Resolves a model's price (EUR / 1M tokens) for a provider. Azure providers use the Azure Retail
/// Prices API (native EUR); all others use the LiteLLM catalog converted USD→EUR. Unresolved → nulls.
/// </summary>
public interface IPricingService
{
    Task<ModelPrice> ResolveAsync(
        IModelProvider provider,
        DiscoveredModel model,
        AzureDeploymentType deploymentType = AzureDeploymentType.GlobalStandard,
        CancellationToken cancellationToken = default);
}
```

- [ ] **Step 3: Build to verify compile**

Run: `dotnet build Proxytrace.Domain`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add Proxytrace.Domain/ModelProvider/IFxRateProvider.cs Proxytrace.Domain/ModelProvider/IPricingService.cs
git commit -m "feat: IPricingService + IFxRateProvider interfaces"
```

---

## Task 3: Frankfurter FX rate provider (Infrastructure)

**Files:**
- Create: `Proxytrace.Infrastructure/Internal/PricingOptions.cs`
- Create: `Proxytrace.Infrastructure/Internal/FrankfurterFxRateProvider.cs`
- Test: `Proxytrace.Infrastructure.Tests/FrankfurterFxRateProviderTests.cs`

- [ ] **Step 1: Invoke the `test` skill.**

- [ ] **Step 2: Create `PricingOptions.cs`** (used here and by later resolvers)

```csharp
namespace Proxytrace.Infrastructure.Internal;

/// <summary>Pricing feed endpoints. Defaults are baked in; override via the "Pricing" config section.</summary>
public sealed class PricingOptions
{
    public string LiteLlmFeedUrl { get; init; } =
        "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
    public string AzureRetailApiUrl { get; init; } = "https://prices.azure.com/api/retail/prices";
    public string FxApiUrl { get; init; } = "https://api.frankfurter.app/latest";
}
```

- [ ] **Step 3: Write the failing test**

```csharp
using System.Net;
using System.Text;
using AwesomeAssertions;
using Proxytrace.Infrastructure.Internal;

namespace Proxytrace.Infrastructure.Tests;

[TestClass]
public sealed class FrankfurterFxRateProviderTests
{
    public required TestContext TestContext { get; init; }

    [TestMethod]
    public async Task GetUsdToEur_ParsesRate()
    {
        var handler = new StubHandler(HttpStatusCode.OK,
            """{"amount":1.0,"base":"USD","date":"2026-06-09","rates":{"EUR":0.92}}""");
        var sut = new FrankfurterFxRateProvider(new HttpClient(handler), new PricingOptions());

        var rate = await sut.GetUsdToEurAsync(TestContext.CancellationToken);

        rate.Should().Be(0.92m);
    }

    [TestMethod]
    public async Task GetUsdToEur_OnFailure_ReturnsNull()
    {
        var handler = new StubHandler(HttpStatusCode.InternalServerError, "boom");
        var sut = new FrankfurterFxRateProvider(new HttpClient(handler), new PricingOptions());

        (await sut.GetUsdToEurAsync(TestContext.CancellationToken)).Should().BeNull();
    }

    private sealed class StubHandler(HttpStatusCode status, string body) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) =>
            Task.FromResult(new HttpResponseMessage(status)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            });
    }
}
```

- [ ] **Step 4: Run it, verify it fails**

Run: `dotnet test Proxytrace.Infrastructure.Tests --filter FrankfurterFxRateProviderTests`
Expected: FAIL (`FrankfurterFxRateProvider` not defined).

- [ ] **Step 5: Implement `FrankfurterFxRateProvider.cs`**

```csharp
using System.Text.Json;
using Proxytrace.Domain.ModelProvider;

namespace Proxytrace.Infrastructure.Internal;

/// <summary>USD→EUR via the free, no-key Frankfurter (ECB) API. Cached for the calendar day.</summary>
internal sealed class FrankfurterFxRateProvider : IFxRateProvider
{
    private readonly HttpClient http;
    private readonly PricingOptions options;
    private readonly SemaphoreSlim gate = new(1, 1);
    private decimal? cachedRate;
    private DateOnly cachedOn;

    public FrankfurterFxRateProvider(HttpClient http, PricingOptions options)
    {
        this.http = http;
        this.options = options;
    }

    public async Task<decimal?> GetUsdToEurAsync(CancellationToken cancellationToken = default)
    {
        DateOnly today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (cachedRate is not null && cachedOn == today)
            return cachedRate;

        await gate.WaitAsync(cancellationToken);
        try
        {
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
        finally
        {
            gate.Release();
        }
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
```

- [ ] **Step 6: Run it, verify it passes**

Run: `dotnet test Proxytrace.Infrastructure.Tests --filter FrankfurterFxRateProviderTests`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add Proxytrace.Infrastructure/Internal/PricingOptions.cs Proxytrace.Infrastructure/Internal/FrankfurterFxRateProvider.cs Proxytrace.Infrastructure.Tests/FrankfurterFxRateProviderTests.cs
git commit -m "feat: Frankfurter USD->EUR FX rate provider (cached daily)"
```

---

## Task 4: LiteLLM catalog resolver (Infrastructure)

**Files:**
- Create: `Proxytrace.Infrastructure/Internal/LiteLlmCatalogResolver.cs`
- Test: `Proxytrace.Infrastructure.Tests/LiteLlmCatalogResolverTests.cs`

The resolver fetches the catalog (cached), looks up by `PricingModelName`, and converts
`usdPerToken × 1_000_000 × fxUsdToEur` → EUR/1M. Missing model or missing FX → `ModelPrice.Unknown`.

- [ ] **Step 1: Invoke the `test` skill.**

- [ ] **Step 2: Write the failing test**

```csharp
using System.Net;
using System.Text;
using AwesomeAssertions;
using NSubstitute;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Infrastructure.Internal;

namespace Proxytrace.Infrastructure.Tests;

[TestClass]
public sealed class LiteLlmCatalogResolverTests
{
    public required TestContext TestContext { get; init; }

    private const string Catalog =
        """
        {
          "sample_spec": { "input_cost_per_token": 0.0, "output_cost_per_token": 0.0 },
          "gpt-4o": { "input_cost_per_token": 0.0000025, "output_cost_per_token": 0.00001 }
        }
        """;

    [TestMethod]
    public async Task Resolve_KnownModel_ConvertsUsdPerTokenToEurPer1M()
    {
        var fx = Substitute.For<IFxRateProvider>();
        fx.GetUsdToEurAsync(Arg.Any<CancellationToken>()).Returns(0.9m);
        var sut = new LiteLlmCatalogResolver(new HttpClient(new StubHandler(HttpStatusCode.OK, Catalog)), new PricingOptions(), fx);

        var price = await sut.ResolveAsync(new DiscoveredModel("gpt-4o", "gpt-4o"), TestContext.CancellationToken);

        // 0.0000025 * 1_000_000 * 0.9 = 2.25 ; 0.00001 * 1_000_000 * 0.9 = 9.0
        price.InputTokenCost.Should().Be(2.25m);
        price.OutputTokenCost.Should().Be(9.0m);
    }

    [TestMethod]
    public async Task Resolve_UnknownModel_ReturnsUnknown()
    {
        var fx = Substitute.For<IFxRateProvider>();
        fx.GetUsdToEurAsync(Arg.Any<CancellationToken>()).Returns(0.9m);
        var sut = new LiteLlmCatalogResolver(new HttpClient(new StubHandler(HttpStatusCode.OK, Catalog)), new PricingOptions(), fx);

        var price = await sut.ResolveAsync(new DiscoveredModel("does-not-exist", "does-not-exist"), TestContext.CancellationToken);

        price.Should().Be(ModelPrice.Unknown);
    }

    [TestMethod]
    public async Task Resolve_NoFxRate_ReturnsUnknown()
    {
        var fx = Substitute.For<IFxRateProvider>();
        fx.GetUsdToEurAsync(Arg.Any<CancellationToken>()).Returns((decimal?)null);
        var sut = new LiteLlmCatalogResolver(new HttpClient(new StubHandler(HttpStatusCode.OK, Catalog)), new PricingOptions(), fx);

        var price = await sut.ResolveAsync(new DiscoveredModel("gpt-4o", "gpt-4o"), TestContext.CancellationToken);

        price.Should().Be(ModelPrice.Unknown);
    }

    private sealed class StubHandler(HttpStatusCode status, string body) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) =>
            Task.FromResult(new HttpResponseMessage(status)
            { Content = new StringContent(body, Encoding.UTF8, "application/json") });
    }
}
```

- [ ] **Step 3: Run it, verify it fails**

Run: `dotnet test Proxytrace.Infrastructure.Tests --filter LiteLlmCatalogResolverTests`
Expected: FAIL (`LiteLlmCatalogResolver` not defined).

- [ ] **Step 4: Implement `LiteLlmCatalogResolver.cs`**

```csharp
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
```

- [ ] **Step 5: Run it, verify it passes**

Run: `dotnet test Proxytrace.Infrastructure.Tests --filter LiteLlmCatalogResolverTests`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add Proxytrace.Infrastructure/Internal/LiteLlmCatalogResolver.cs Proxytrace.Infrastructure.Tests/LiteLlmCatalogResolverTests.cs
git commit -m "feat: LiteLLM catalog resolver (USD/token -> EUR/1M via FX)"
```

---

## Task 5: Azure Retail Prices resolver (Infrastructure)

**Files:**
- Create: `Proxytrace.Infrastructure/Internal/AzureRetailPriceResolver.cs`
- Test: `Proxytrace.Infrastructure.Tests/AzureRetailPriceResolverTests.cs`

Queries the Azure Retail Prices API with `currencyCode='EUR'` and `serviceName eq 'Cognitive Services'`,
then matches items by base model, direction (input/output), and deployment-type fragment in `meterName`.
Normalizes per-1K (`unitOfMeasure` starting with `1K`) to per-1M (×1000). No match → `ModelPrice.Unknown`.

**Matching rules (locked by tests):**
- model match: `meterName` contains the model name (case-insensitive); the model token in meters uses spaces not dashes, so compare with dashes→spaces normalization (`gpt-4o` → `gpt 4o`).
- direction: input meters contain `Inp` / `Input`; output meters contain `Outp` / `Output`.
- deployment type fragment: `GlobalStandard`→`glbl`/`Global`; `DataZoneStandard`→`Data Zone`; `Standard`→ meter has neither `glbl`/`Global` nor `Data Zone`.

- [ ] **Step 1: Invoke the `test` skill.**

- [ ] **Step 2: Write the failing test**

```csharp
using System.Net;
using System.Text;
using AwesomeAssertions;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Infrastructure.Internal;

namespace Proxytrace.Infrastructure.Tests;

[TestClass]
public sealed class AzureRetailPriceResolverTests
{
    public required TestContext TestContext { get; init; }

    // retailPrice is per 1K tokens (unitOfMeasure "1K"); EUR.
    private const string Response =
        """
        {
          "Items": [
            { "currencyCode":"EUR","retailPrice":0.0025,"unitOfMeasure":"1K","meterName":"gpt 4o Inp glbl","serviceName":"Cognitive Services","skuName":"Standard" },
            { "currencyCode":"EUR","retailPrice":0.01,"unitOfMeasure":"1K","meterName":"gpt 4o Outp glbl","serviceName":"Cognitive Services","skuName":"Standard" },
            { "currencyCode":"EUR","retailPrice":0.99,"unitOfMeasure":"1K","meterName":"gpt 4o Inp Data Zone","serviceName":"Cognitive Services","skuName":"Standard" }
          ],
          "NextPageLink": null
        }
        """;

    [TestMethod]
    public async Task Resolve_GlobalStandard_MatchesGlobalMetersAndNormalizesTo1M()
    {
        var sut = new AzureRetailPriceResolver(new HttpClient(new StubHandler(Response)), new PricingOptions());

        var price = await sut.ResolveAsync(new DiscoveredModel("my-deploy", "gpt-4o"),
            AzureDeploymentType.GlobalStandard, TestContext.CancellationToken);

        // 0.0025 per 1K * 1000 = 2.5 per 1M ; 0.01 * 1000 = 10.0
        price.InputTokenCost.Should().Be(2.5m);
        price.OutputTokenCost.Should().Be(10.0m);
    }

    [TestMethod]
    public async Task Resolve_DataZone_PicksDataZoneMeter()
    {
        var sut = new AzureRetailPriceResolver(new HttpClient(new StubHandler(Response)), new PricingOptions());

        var price = await sut.ResolveAsync(new DiscoveredModel("my-deploy", "gpt-4o"),
            AzureDeploymentType.DataZoneStandard, TestContext.CancellationToken);

        price.InputTokenCost.Should().Be(990.0m); // 0.99 * 1000
    }

    [TestMethod]
    public async Task Resolve_NoMatch_ReturnsUnknown()
    {
        var sut = new AzureRetailPriceResolver(new HttpClient(new StubHandler(Response)), new PricingOptions());

        var price = await sut.ResolveAsync(new DiscoveredModel("x", "claude-3"),
            AzureDeploymentType.GlobalStandard, TestContext.CancellationToken);

        price.Should().Be(ModelPrice.Unknown);
    }

    private sealed class StubHandler(string body) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            { Content = new StringContent(body, Encoding.UTF8, "application/json") });
    }
}
```

- [ ] **Step 3: Run it, verify it fails**

Run: `dotnet test Proxytrace.Infrastructure.Tests --filter AzureRetailPriceResolverTests`
Expected: FAIL (`AzureRetailPriceResolver` not defined).

- [ ] **Step 4: Implement `AzureRetailPriceResolver.cs`**

```csharp
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
            // fail-soft
        }
        return meters;
    }

    private readonly record struct Meter(string MeterName, string UnitOfMeasure, decimal RetailPrice);
}
```

> **Note for executor:** Live Azure meter names vary (e.g. `"gpt-4o-0513 Inp glbl"`). The matcher is a best-effort heuristic; the tests pin its contract. Refine the fragments against live data if needed, keeping the tests green.

- [ ] **Step 5: Run it, verify it passes**

Run: `dotnet test Proxytrace.Infrastructure.Tests --filter AzureRetailPriceResolverTests`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add Proxytrace.Infrastructure/Internal/AzureRetailPriceResolver.cs Proxytrace.Infrastructure.Tests/AzureRetailPriceResolverTests.cs
git commit -m "feat: Azure Retail Prices resolver (EUR, per-1M, deployment-type aware)"
```

---

## Task 6: PricingService (Infrastructure) — resolver selection

**Files:**
- Create: `Proxytrace.Infrastructure/Internal/PricingService.cs`
- Test: `Proxytrace.Infrastructure.Tests/PricingServiceTests.cs`

`PricingService` chooses Azure vs LiteLLM by `ProviderEndpoints.IsAzure(provider.Endpoint)`. To keep
the resolvers concrete-but-injectable, `PricingService` takes them by concrete type (both are
internal). The test exercises selection by passing real resolvers backed by stub handlers.

- [ ] **Step 1: Invoke the `test` skill.**

- [ ] **Step 2: Write the failing test**

```csharp
using System.Net;
using System.Text;
using AwesomeAssertions;
using NSubstitute;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Infrastructure.Internal;

namespace Proxytrace.Infrastructure.Tests;

[TestClass]
public sealed class PricingServiceTests
{
    public required TestContext TestContext { get; init; }

    [TestMethod]
    public async Task Resolve_AzureProvider_UsesAzureResolver()
    {
        const string azureBody =
            """{"Items":[{"currencyCode":"EUR","retailPrice":0.002,"unitOfMeasure":"1K","meterName":"gpt 4o Inp glbl","serviceName":"Cognitive Services","skuName":"Standard"}]}""";
        var sut = BuildService(azureBody, liteLlmBody: "{}", fx: 0.9m);

        var price = await sut.ResolveAsync(
            StubProvider("https://x.openai.azure.com/"),
            new DiscoveredModel("d", "gpt-4o"),
            AzureDeploymentType.GlobalStandard, TestContext.CancellationToken);

        price.InputTokenCost.Should().Be(2.0m); // proves Azure path (per-1K*1000), not LiteLLM
    }

    [TestMethod]
    public async Task Resolve_NonAzureProvider_UsesLiteLlmResolver()
    {
        const string catalog = """{"gpt-4o":{"input_cost_per_token":0.000001,"output_cost_per_token":0.000002}}""";
        var sut = BuildService(azureBody: "{}", liteLlmBody: catalog, fx: 0.5m);

        var price = await sut.ResolveAsync(
            StubProvider("https://api.openai.com/v1"),
            new DiscoveredModel("gpt-4o", "gpt-4o"),
            AzureDeploymentType.GlobalStandard, TestContext.CancellationToken);

        price.InputTokenCost.Should().Be(0.5m); // 0.000001 * 1e6 * 0.5
    }

    private static IModelProvider StubProvider(string endpoint)
    {
        var p = Substitute.For<IModelProvider>();
        p.Endpoint.Returns(new Uri(endpoint));
        return p;
    }

    private static PricingService BuildService(string azureBody, string liteLlmBody, decimal fx)
    {
        var opts = new PricingOptions();
        var azure = new AzureRetailPriceResolver(new HttpClient(new StubHandler(azureBody)), opts);
        var fxProvider = Substitute.For<IFxRateProvider>();
        fxProvider.GetUsdToEurAsync(Arg.Any<CancellationToken>()).Returns(fx);
        var liteLlm = new LiteLlmCatalogResolver(new HttpClient(new StubHandler(liteLlmBody)), opts, fxProvider);
        return new PricingService(azure, liteLlm);
    }

    private sealed class StubHandler(string body) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            { Content = new StringContent(body, Encoding.UTF8, "application/json") });
    }
}
```

- [ ] **Step 3: Run it, verify it fails**

Run: `dotnet test Proxytrace.Infrastructure.Tests --filter PricingServiceTests`
Expected: FAIL (`PricingService` not defined).

- [ ] **Step 4: Implement `PricingService.cs`**

```csharp
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
```

- [ ] **Step 5: Run it, verify it passes**

Run: `dotnet test Proxytrace.Infrastructure.Tests --filter PricingServiceTests`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add Proxytrace.Infrastructure/Internal/PricingService.cs Proxytrace.Infrastructure.Tests/PricingServiceTests.cs
git commit -m "feat: PricingService selects Azure vs LiteLLM resolver by endpoint"
```

---

## Task 7: Register pricing services (Infrastructure DI + config)

**Files:**
- Modify: `Proxytrace.Infrastructure/Module.cs`
- Modify: `Proxytrace.Api/appsettings.json`
- Modify: `Proxytrace.Api/appsettings.example.json`

- [ ] **Step 1: Add the `Pricing` config section to `appsettings.json`** (after the `ModelProvider` block)

```json
  "Pricing": {
    "LiteLlmFeedUrl": "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json",
    "AzureRetailApiUrl": "https://prices.azure.com/api/retail/prices",
    "FxApiUrl": "https://api.frankfurter.app/latest"
  },
```

- [ ] **Step 2: Mirror the same block into `appsettings.example.json`.**

- [ ] **Step 3: Register services in `Proxytrace.Infrastructure/Module.cs`**

Add `using Microsoft.Extensions.Configuration;` and inside `Load`, after the `ProviderClient` registration:

```csharp
        builder.Register(c =>
            {
                var cfg = c.Resolve<IConfiguration>().GetSection("Pricing");
                var defaults = new PricingOptions();
                return new PricingOptions
                {
                    LiteLlmFeedUrl = cfg["LiteLlmFeedUrl"] ?? defaults.LiteLlmFeedUrl,
                    AzureRetailApiUrl = cfg["AzureRetailApiUrl"] ?? defaults.AzureRetailApiUrl,
                    FxApiUrl = cfg["FxApiUrl"] ?? defaults.FxApiUrl,
                };
            })
            .AsSelf()
            .SingleInstance();

        builder.Register(_ => new HttpClient())
            .Named<HttpClient>("pricing")
            .SingleInstance();

        builder.RegisterType<FrankfurterFxRateProvider>()
            .As<IFxRateProvider>()
            .WithParameter(ResolvedParameter.ForNamed<HttpClient>("pricing"))
            .SingleInstance();

        builder.RegisterType<LiteLlmCatalogResolver>()
            .AsSelf()
            .WithParameter(ResolvedParameter.ForNamed<HttpClient>("pricing"))
            .SingleInstance();

        builder.RegisterType<AzureRetailPriceResolver>()
            .AsSelf()
            .WithParameter(ResolvedParameter.ForNamed<HttpClient>("pricing"))
            .SingleInstance();

        builder.RegisterType<PricingService>()
            .As<IPricingService>()
            .SingleInstance();
```

Add `using Autofac.Core;` for `ResolvedParameter`.

- [ ] **Step 4: Build**

Run: `dotnet build Proxytrace.Infrastructure`
Expected: success.

- [ ] **Step 5: Verify the API module still composes (DI sanity)**

Run: `dotnet test Proxytrace.Api.Tests --filter ModuleTests`
Expected: PASS (the existing container-composition test).

- [ ] **Step 6: Commit**

```bash
git add Proxytrace.Infrastructure/Module.cs Proxytrace.Api/appsettings.json Proxytrace.Api/appsettings.example.json
git commit -m "feat: register pricing services + Pricing config section"
```

---

## Task 8: `DiscoverModelsAsync` on the provider client

**Files:**
- Modify: `Proxytrace.Domain/ModelProvider/IProviderClient.cs`
- Modify: `Proxytrace.Infrastructure/Internal/ProviderClient.cs`
- Modify: `Proxytrace.Proxy/Controllers/UnusedProviderClient.cs`
- Test: `Proxytrace.Infrastructure.Tests/ProviderClientTests.cs` (extend)

Adds discovery that returns `(Name, PricingModelName)`. Azure path uses deployments only (reusing the
existing logic, extended to capture each deployment's base `model`) and **never** falls back to `/models`.

- [ ] **Step 1: Invoke the `test` skill.**

- [ ] **Step 2: Add the interface member** in `IProviderClient.cs`

```csharp
    Task<IReadOnlyList<DiscoveredModel>> DiscoverModelsAsync(CancellationToken cancellationToken = default);
```

- [ ] **Step 3: Write the failing test** (extend `ProviderClientTests.cs`)

```csharp
    [TestMethod]
    public async Task DiscoverModels_Azure_UsesDeploymentsAndNeverFallsBackToModelsList()
    {
        // Azure deployments endpoint returns one deployment; the /models list (if ever called) would
        // return a huge list. Assert we get exactly the deployment, mapped to its base model.
        var handler = new RoutingHandler(
            deploymentsJson: """{"data":[{"id":"my-deploy","model":"gpt-4o"}]}""",
            modelsJson: """{"data":[{"id":"should-not-appear"}]}""");
        var provider = StubAzureProvider();
        var client = new ProviderClient(provider, Substitute.For<IModelRepository>(), new HttpClient(handler));

        var result = await client.DiscoverModelsAsync(TestContext.CancellationToken);

        result.Should().ContainSingle();
        result[0].Name.Should().Be("my-deploy");
        result[0].PricingModelName.Should().Be("gpt-4o");
    }

    [TestMethod]
    public async Task DiscoverModels_Azure_DeploymentsFail_ReturnsEmpty_NoModelsFallback()
    {
        var handler = new RoutingHandler(
            deploymentsJson: null, // deployments endpoint 500s
            modelsJson: """{"data":[{"id":"should-not-appear"}]}""");
        var provider = StubAzureProvider();
        var client = new ProviderClient(provider, Substitute.For<IModelRepository>(), new HttpClient(handler));

        var result = await client.DiscoverModelsAsync(TestContext.CancellationToken);

        result.Should().BeEmpty();
    }

    private static IModelProvider StubAzureProvider()
    {
        var provider = Substitute.For<IModelProvider>();
        provider.Endpoint.Returns(new Uri("https://my-resource.openai.azure.com/"));
        provider.ApiKey.Returns("sk-test");
        provider.Kind.Returns(ModelProviderKind.OpenAiCompatible);
        return provider;
    }

    private sealed class RoutingHandler(string? deploymentsJson, string modelsJson) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            string path = request.RequestUri!.AbsolutePath;
            if (path.Contains("/deployments"))
            {
                return Task.FromResult(deploymentsJson is null
                    ? new HttpResponseMessage(System.Net.HttpStatusCode.InternalServerError)
                    : new HttpResponseMessage(System.Net.HttpStatusCode.OK)
                      { Content = new StringContent(deploymentsJson, System.Text.Encoding.UTF8, "application/json") });
            }
            return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK)
                { Content = new StringContent(modelsJson, System.Text.Encoding.UTF8, "application/json") });
        }
    }
```

> **Note:** This requires `ProviderClient` to accept an injectable `HttpClient` (currently it news one up inline). Step 5 adds that constructor parameter.

- [ ] **Step 4: Run it, verify it fails**

Run: `dotnet test Proxytrace.Infrastructure.Tests --filter ProviderClientTests`
Expected: FAIL (no `DiscoverModelsAsync`, no `HttpClient` ctor param).

- [ ] **Step 5: Implement in `ProviderClient.cs`**

Add an injected `HttpClient` (replacing the inline `new HttpClient()` in `TryGetAzureDeploymentNamesAsync`):

```csharp
    private readonly HttpClient http;

    public ProviderClient(
        IModelProvider provider,
        IModelRepository modelRepository,
        HttpClient http)
    {
        this.provider = provider;
        this.modelRepository = modelRepository;
        this.http = http;
    }
```

Add the discovery method:

```csharp
    public async Task<IReadOnlyList<DiscoveredModel>> DiscoverModelsAsync(CancellationToken cancellationToken = default)
    {
        if (ProviderEndpoints.IsAzure(provider.Endpoint))
        {
            // Azure: deployed models only; never fall back to the (far too large) /models list.
            return await GetAzureDeploymentsAsync(cancellationToken);
        }

        IReadOnlyList<string> names = await GetOpenAiModelNamesAsync(cancellationToken);
        return names.Select(n => new DiscoveredModel(n, n)).ToArray();
    }
```

Replace `TryGetAzureDeploymentNamesAsync` with a version that returns `DiscoveredModel`s (deployment `id` → `Name`, base `model` → `PricingModelName`), reusing the same URL-building + headers, and using the injected `http` (drop `using var http = new HttpClient();`). On any failure or non-success → return empty list:

```csharp
    private async Task<IReadOnlyList<DiscoveredModel>> GetAzureDeploymentsAsync(CancellationToken cancellationToken)
    {
        try
        {
            string basePath = StripOpenAiSuffix(provider.Endpoint.AbsolutePath);
            var builder = new UriBuilder(provider.Endpoint)
            {
                Path = $"{basePath}/openai/deployments",
                Query = $"api-version={AzureDeploymentsApiVersion}",
            };

            using var request = new HttpRequestMessage(HttpMethod.Get, builder.Uri);
            request.Headers.Add("api-key", provider.ApiKey);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", provider.ApiKey);

            using HttpResponseMessage response = await http.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
                return [];

            await using Stream stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using JsonDocument doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            if (!doc.RootElement.TryGetProperty("data", out JsonElement data) || data.ValueKind != JsonValueKind.Array)
                return [];

            var models = new List<DiscoveredModel>();
            foreach (JsonElement item in data.EnumerateArray())
            {
                string? id = item.TryGetProperty("id", out JsonElement idEl) && idEl.ValueKind == JsonValueKind.String
                    ? idEl.GetString() : null;
                if (string.IsNullOrWhiteSpace(id))
                    continue;
                string baseModel = item.TryGetProperty("model", out JsonElement mEl) && mEl.ValueKind == JsonValueKind.String
                    ? mEl.GetString() ?? id : id;
                models.Add(new DiscoveredModel(id, baseModel));
            }
            return models;
        }
        catch
        {
            return [];
        }
    }
```

> **Keep** `GetModelsAsync` unchanged for existing callers (`SetupService`, `UnusedProviderClient`). Its current Azure-first/`/models`-fallback behavior is independent of the new method. Update `GetModelsAsync`'s call to the old `TryGetAzureDeploymentNamesAsync` to use `GetAzureDeploymentsAsync(...).Select(d => d.Name)` so only one Azure code path remains.

`CreateOpenAiClient`/`GetOpenAiModelNamesAsync`/`StripOpenAiSuffix`/`EnsureSupportedKind` stay. `GetOpenAiModelNamesAsync` keeps newing its own `OpenAIModelClient` (SDK client, not the raw `HttpClient`).

- [ ] **Step 5b: Fix the existing `ProviderClientTests` constructor calls.** The current tests build `new ProviderClient(provider, Substitute.For<IModelRepository>())` (2-arg) at three call sites — they must now pass an `HttpClient`. Update each to `new ProviderClient(provider, Substitute.For<IModelRepository>(), new HttpClient())`.

- [ ] **Step 6: Implement the interface member in `UnusedProviderClient.cs`** (stub, matching the file's style)

```csharp
    public Task<IReadOnlyList<DiscoveredModel>> DiscoverModelsAsync(CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<DiscoveredModel>>([]);
```

- [ ] **Step 7: Update the DI registration for `ProviderClient`** in `Proxytrace.Infrastructure/Module.cs` to supply the named pricing `HttpClient`:

```csharp
        builder.RegisterType<ProviderClient>()
            .As<IProviderClient>()
            .WithParameter(ResolvedParameter.ForNamed<HttpClient>("pricing"));
```

- [ ] **Step 8: Run the tests**

Run: `dotnet test Proxytrace.Infrastructure.Tests --filter ProviderClientTests`
Expected: PASS (new + existing).

- [ ] **Step 9: Build the whole solution** (catch `UnusedProviderClient`/`SetupService` breakage)

Run: `dotnet build`
Expected: success.

- [ ] **Step 10: Commit**

```bash
git add Proxytrace.Domain/ModelProvider/IProviderClient.cs Proxytrace.Infrastructure/Internal/ProviderClient.cs Proxytrace.Proxy/Controllers/UnusedProviderClient.cs Proxytrace.Infrastructure/Module.cs Proxytrace.Infrastructure.Tests/ProviderClientTests.cs
git commit -m "feat: DiscoverModelsAsync - Azure deployed models only, base model for pricing"
```

---

## Task 9: Auto-load on create + reload endpoint (API)

**Files:**
- Modify: `Proxytrace.Api/Controllers/ModelProvidersController.cs`
- Test: extend the providers controller API test (find it: `ls Proxytrace.Api.Tests | grep -i provider`; if none, create `Proxytrace.Api.Tests/ModelProvidersControllerTests.cs`)

Behavior:
- `Create` saves the provider, then best-effort populates endpoints (default `GlobalStandard`). Failure must not fail the create.
- New `POST {providerId}/reload?deploymentType=GlobalStandard` re-runs discovery+pricing, creating only missing endpoints.
- `GetAvailableModels` switches to `DiscoverModelsAsync` (returns names).

- [ ] **Step 1: Invoke the `test` skill.**

- [ ] **Step 2: Add the shared population helper + reload endpoint + create hook** in `ModelProvidersController.cs`

Inject `IPricingService pricingService` (add field + ctor param).

Add a private helper:

```csharp
    private async Task PopulateModelsAsync(
        IModelProvider provider, AzureDeploymentType deploymentType, CancellationToken cancellationToken)
    {
        IReadOnlyList<IModelEndpoint> existing = await endpointRepository.GetAllAsync(cancellationToken);
        var existingNames = existing
            .Where(e => e.Provider.Id == provider.Id)
            .Select(e => e.Model.Name)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        IReadOnlyList<DiscoveredModel> discovered;
        try
        {
            discovered = await provider.CreateClient().DiscoverModelsAsync(cancellationToken);
        }
        catch
        {
            return; // fail-soft: provider stays usable, no endpoints added
        }

        foreach (DiscoveredModel dm in discovered)
        {
            if (existingNames.Contains(dm.Name))
                continue;
            ModelPrice price = await pricingService.ResolveAsync(provider, dm, deploymentType, cancellationToken);
            IModel model = await modelRepository.GetOrCreateAsync(dm.Name, cancellationToken);
            IModelEndpoint endpoint = createEndpoint(model, provider, price.InputTokenCost, price.OutputTokenCost);
            await endpointRepository.AddAsync(endpoint, cancellationToken);
        }
    }
```

Call it from `Create` after `AddAsync` (best-effort, not awaited into the response failure path — but DO await so endpoints exist before the client refetches):

```csharp
        var saved = await providerRepository.AddAsync(provider, cancellationToken);
        await PopulateModelsAsync(saved, AzureDeploymentType.GlobalStandard, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = saved.Id }, mapper.ToDto(saved));
```

Add the reload action:

```csharp
    [HttpPost("{providerId:guid}/reload")]
    public async Task<ActionResult<IReadOnlyList<ModelEndpointDto>>> Reload(
        Guid providerId,
        [FromQuery] AzureDeploymentType deploymentType = AzureDeploymentType.GlobalStandard,
        CancellationToken cancellationToken = default)
    {
        var provider = await providerRepository.FindAsync(providerId, cancellationToken);
        if (provider is null)
            return NotFound("Provider not found.");

        await PopulateModelsAsync(provider, deploymentType, cancellationToken);

        var all = await endpointRepository.GetAllAsync(cancellationToken);
        return all.Where(e => e.Provider.Id == providerId).Select(mapper.ToEndpointDto).ToArray();
    }
```

Switch `GetAvailableModels` to discovery:

```csharp
        var provider = await providerRepository.GetAsync(providerId, cancellationToken);
        var discovered = await provider.CreateClient().DiscoverModelsAsync(cancellationToken);
        return discovered.Select(d => d.Name).OrderBy(n => n).ToArray();
```

Add `using Proxytrace.Domain.ModelProvider;` is already present; ensure `IPricingService`, `DiscoveredModel`, `ModelPrice`, `AzureDeploymentType` resolve (same namespace).

- [ ] **Step 3: Write the failing API test**

Model it on the existing controller tests' harness (per the `test` skill). Representative assertions:

```csharp
// Given a provider whose client discovers ["gpt-4o"] and pricing resolves (2.5, 10.0):
// POST /api/providers creates the provider AND a model endpoint with those costs.
// POST /api/providers/{id}/reload?deploymentType=DataZoneStandard creates only missing endpoints.
```

Wire the test's container so `IProviderClient` discovers a known list and `IPricingService` returns a fixed `ModelPrice` (substitute both). Assert: after create, `GET {id}/models` returns one endpoint with `inputTokenCost == 2.5`; a second reload with the same model adds nothing.

> Follow the `test` skill for the exact fixture/registration pattern used by `AgentsControllerTests`/`EvaluatorsControllerTests`.

- [ ] **Step 4: Run it, verify it fails**, then **implement until green**.

Run: `dotnet test Proxytrace.Api.Tests --filter ModelProvidersControllerTests`
Expected: FAIL → (after Step 2 wired) PASS.

- [ ] **Step 5: Commit**

```bash
git add Proxytrace.Api/Controllers/ModelProvidersController.cs Proxytrace.Api.Tests/ModelProvidersControllerTests.cs
git commit -m "feat: auto-load models+prices on provider create; reload endpoint"
```

---

## Task 10: Frontend API + types + hooks

**Files:**
- Modify: `frontend/src/api/models.ts`
- Modify: `frontend/src/api/providers.ts`
- Modify: `frontend/src/features/providers/hooks/useProviderMutations.ts`

> Read `frontend/BEST_PRACTICES.md` first.

- [ ] **Step 1: Add types to `models.ts`** (near the Providers block)

```ts
export enum AzureDeploymentType {
  GlobalStandard = 'GlobalStandard',
  DataZoneStandard = 'DataZoneStandard',
  Standard = 'Standard',
}
```

- [ ] **Step 2: Add the reload call to `providers.ts`**

```ts
  reload: (providerId: string, deploymentType: AzureDeploymentType) =>
    api.post<ModelEndpointDto[]>(`/api/providers/${providerId}/reload?deploymentType=${deploymentType}`, {}),
```

Add `AzureDeploymentType` to the import from `./models`.

- [ ] **Step 3: Add the `useReloadProvider` hook to `useProviderMutations.ts`**

```ts
/** Re-discovers a provider's models and refreshes pricing; invalidates the overview. */
export function useReloadProvider(providerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deploymentType: AzureDeploymentType) => providersApi.reload(providerId, deploymentType),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.providersOverview }),
  });
}
```

Add `AzureDeploymentType` to the type import.

- [ ] **Step 4: Typecheck + lint**

Run: `cd frontend && npm run lint && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/models.ts frontend/src/api/providers.ts frontend/src/features/providers/hooks/useProviderMutations.ts
git commit -m "feat(fe): reload provider api + AzureDeploymentType + hook"
```

---

## Task 11: providerMeta — default endpoints + Azure detection

**Files:**
- Modify: `frontend/src/features/providers/providerMeta.ts`
- Modify: `frontend/src/features/providers/providerMeta.spec.ts`

- [ ] **Step 1: Write the failing tests** (add to `providerMeta.spec.ts`)

```ts
import { isDefaultEndpoint, isAzureEndpoint } from './providerMeta';
import { ModelProviderKind } from '../../api/models';

describe('isDefaultEndpoint', () => {
  it('treats canonical Anthropic/OpenAI endpoints as default', () => {
    expect(isDefaultEndpoint(ModelProviderKind.Anthropic, 'https://api.anthropic.com/v1')).toBe(true);
    expect(isDefaultEndpoint(ModelProviderKind.OpenAi, 'https://api.openai.com/v1')).toBe(true);
  });
  it('treats custom endpoints as non-default', () => {
    expect(isDefaultEndpoint(ModelProviderKind.OpenAi, 'https://proxy.internal/v1')).toBe(false);
    expect(isDefaultEndpoint(ModelProviderKind.OpenAiCompatible, 'https://x.openai.azure.com/')).toBe(false);
  });
});

describe('isAzureEndpoint', () => {
  it('detects azure hosts', () => {
    expect(isAzureEndpoint('https://r.openai.azure.com/')).toBe(true);
    expect(isAzureEndpoint('https://api.openai.com/v1')).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd frontend && npx vitest run src/features/providers/providerMeta.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement in `providerMeta.ts`**

```ts
const DEFAULT_ENDPOINT: Partial<Record<ModelProviderKind, string>> = {
  [ModelProviderKind.Anthropic]: 'https://api.anthropic.com/v1',
  [ModelProviderKind.OpenAi]: 'https://api.openai.com/v1',
};

function normalizeUrl(u: string): string {
  return u.trim().replace(/\/+$/, '').toLowerCase();
}

/** True when the endpoint equals the canonical default for its kind (so it can be hidden). */
export function isDefaultEndpoint(kind: ModelProviderKind, endpoint: string): boolean {
  const def = DEFAULT_ENDPOINT[kind];
  return def != null && normalizeUrl(def) === normalizeUrl(endpoint);
}

/** True when the endpoint host indicates an Azure OpenAI resource. */
export function isAzureEndpoint(endpoint: string): boolean {
  try {
    return new URL(endpoint).host.toLowerCase().includes('azure.com');
  } catch {
    return endpoint.toLowerCase().includes('azure.com');
  }
}

export const AZURE_DEPLOYMENT_TYPE_OPTIONS = [
  { value: 'GlobalStandard', label: 'Global Standard' },
  { value: 'DataZoneStandard', label: 'Data Zone Standard' },
  { value: 'Standard', label: 'Standard (Regional)' },
] as const;
```

- [ ] **Step 4: Run, verify pass**

Run: `cd frontend && npx vitest run src/features/providers/providerMeta.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/providers/providerMeta.ts frontend/src/features/providers/providerMeta.spec.ts
git commit -m "feat(fe): default-endpoint + azure detection helpers"
```

---

## Task 12: Header shows endpoint only when non-default

**Files:**
- Modify: `frontend/src/features/providers/components/ProviderDetailHeader.tsx`

- [ ] **Step 1: Guard the endpoint line** (replace the unconditional endpoint `<div>` at `ProviderDetailHeader.tsx:69`)

```tsx
          {!isDefaultEndpoint(provider.kind, provider.endpoint) && (
            <div className="flex items-center gap-1.5 min-w-0">
              {isAzureEndpoint(provider.endpoint) && (
                <ColoredBadge color="var(--teal)" label="Azure" />
              )}
              <span className="font-mono text-body text-muted truncate" title={provider.endpoint}>
                {provider.endpoint}
              </span>
            </div>
          )}
```

Add `isDefaultEndpoint, isAzureEndpoint` to the existing `../providerMeta` import.

- [ ] **Step 2: Typecheck + lint**

Run: `cd frontend && npm run lint && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/providers/components/ProviderDetailHeader.tsx
git commit -m "feat(fe): hide endpoint when default, badge azure when custom"
```

---

## Task 13: Replace tabs with stacked sections

**Files:**
- Rename: `frontend/src/features/providers/components/ModelsTab.tsx` → `ModelsSection.tsx`
- Rename: `frontend/src/features/providers/components/KeysTab.tsx` → `KeysSection.tsx`
- Modify: `frontend/src/features/providers/components/ProviderDetail.tsx`
- Modify: `frontend/src/features/providers/Providers.tsx`

- [ ] **Step 1: Rename the two files** and rename their exported components (`ModelsTab`→`ModelsSection`, `KeysTab`→`KeysSection`). Keep their props and internals unchanged.

```bash
git mv frontend/src/features/providers/components/ModelsTab.tsx frontend/src/features/providers/components/ModelsSection.tsx
git mv frontend/src/features/providers/components/KeysTab.tsx frontend/src/features/providers/components/KeysSection.tsx
```

Update the `export function ModelsTab` → `export function ModelsSection` (and `KeysTab` → `KeysSection`) declarations inside each file.

- [ ] **Step 2: Add a reload control to `ModelsSection`'s header** (Models section heading row). Add props `onReload: (t: AzureDeploymentType) => void`, `reloading: boolean`, `isAzure: boolean`, and `reloadDeploymentType` state local to the section:

```tsx
      <div className="flex items-center gap-2">
        {isAzure && (
          <div className="w-44">
            <Select inputSize="sm" value={reloadType} onChange={e => setReloadType(e.target.value as AzureDeploymentType)}>
              {AZURE_DEPLOYMENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
        )}
        <Button data-testid="model-reload-btn" variant="ghost" size="sm" loading={reloading} onClick={() => onReload(reloadType)}>
          Reload models &amp; prices
        </Button>
        <Button data-testid="model-add-btn" variant="secondary" size="sm" leftIcon={<PlusIcon size={13} />} onClick={/* existing */}>
          Add model
        </Button>
      </div>
```

Add imports for `AzureDeploymentType`, `AZURE_DEPLOYMENT_TYPE_OPTIONS`, and `useState` (`const [reloadType, setReloadType] = useState<AzureDeploymentType>(AzureDeploymentType.GlobalStandard)`).

- [ ] **Step 3: Rewrite `ProviderDetail.tsx`** — drop `Tabs`, render stacked sections

```tsx
import type { ApiKeyDto, ModelEndpointDto, ProjectDto, ProviderDto } from '../../../api/models';
import { Card } from '../../../components/ui/Card';
import { ProviderDetailHeader } from './ProviderDetailHeader';
import { ModelsSection } from './ModelsSection';
import { KeysSection } from './KeysSection';
import { isAzureEndpoint } from '../providerMeta';
import { useReloadProvider } from '../hooks/useProviderMutations';
import type { AzureDeploymentType } from '../../../api/models';

interface ProviderDetailProps {
  provider: ProviderDto;
  models: ModelEndpointDto[];
  keys: ApiKeyDto[];
  projects: ProjectDto[];
  defaultProjectId: string;
  onDeleted: () => void;
}

export function ProviderDetail({ provider, models, keys, projects, defaultProjectId, onDeleted }: ProviderDetailProps) {
  const reload = useReloadProvider(provider.id);
  return (
    <Card elevation="raised" padding="none" className="flex flex-col overflow-hidden">
      <ProviderDetailHeader provider={provider} onDeleted={onDeleted} />
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-8">
        <ModelsSection
          providerId={provider.id}
          models={models}
          isAzure={isAzureEndpoint(provider.endpoint)}
          reloading={reload.isPending}
          onReload={(t: AzureDeploymentType) => reload.mutate(t)}
        />
        <KeysSection providerId={provider.id} keys={keys} projects={projects} defaultProjectId={defaultProjectId} />
      </div>
    </Card>
  );
}
```

Remove the `ProviderTab` export and all tab state.

- [ ] **Step 4: Update `Providers.tsx`** — remove `tab`/`onTabChange` state and the `ProviderTab` import; drop those props from `<ProviderDetail>`.

Remove: `const [tab, setTab] = useState<ProviderTab>('models');`, the `ProviderTab` import, and `tab={tab} onTabChange={setTab}`.

- [ ] **Step 5: Typecheck + lint + unit tests**

Run: `cd frontend && npm run lint && npx tsc --noEmit && npx vitest run src/features/providers`
Expected: clean / pass.

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src/features/providers
git commit -m "feat(fe): stacked Models/API-keys sections (no tabs) + reload control"
```

---

## Task 14: Verify full build/tests, then e2e + docs

**Files:**
- Modify: `docs/frontend.md`
- Modify/Create: `manual/guide/` providers page (+ `manual/.vitepress/config.ts` only if a new page)
- e2e: per `create-e2e-test` skill

- [ ] **Step 1: Backend + frontend green**

Run: `dotnet test` and `cd frontend && npm run lint && npx tsc --noEmit && npx vitest run`
Expected: all pass.

- [ ] **Step 2: e2e** — invoke `create-e2e-test`, then extend the providers spec to assert: (a) detail panel has **no tabs** (no `getByRole('tab')`), (b) a default-endpoint provider hides its endpoint while a custom/Azure one shows it, (c) after creating a provider whose upstream discovers models, the Models section lists them. Run per `run-e2e-tests`.

- [ ] **Step 3: Update `docs/frontend.md`** — note the providers detail is now stacked sections (no tabs) and the endpoint-display rule.

- [ ] **Step 4: Update the user manual** — in `manual/guide/` providers page, document: models + prices auto-load on provider create; the "Reload models & prices" button and the Azure deployment-type selector; that Azure prices come from the Azure Retail Prices API (EUR) and others from LiteLLM converted via ECB FX; pricing-feed config keys (`Pricing:*`). Preview: `cd manual && npm run docs:dev`; verify: `npm run docs:build`.

- [ ] **Step 5: Commit**

```bash
git add docs/frontend.md manual e2e
git commit -m "docs+test: providers story e2e + manual + frontend doc"
```

---

## Notes for the executor

- **Fail-soft everywhere:** pricing/discovery failures never block provider create or delete existing endpoints. Costs simply stay `null`.
- **No domain/DB change:** if you find yourself editing `IModelProvider`, `ModelProviderKind`, `ModelEndpointEntity`, or adding a migration, stop — that violates the spec.
- **EUR storage unchanged:** resolvers output EUR/1M; the existing `InputTokenCost`/`OutputTokenCost` fields and `€` labels are correct.
- **Azure meter matching** (Task 5) is heuristic; if live data differs, adjust the fragment matching but keep the unit tests as the contract.
