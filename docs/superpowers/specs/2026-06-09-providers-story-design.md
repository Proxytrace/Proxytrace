# Providers Story — Design

**Date:** 2026-06-09
**Status:** Approved (design), pending implementation plan
**Branch:** feature/refactor

## Goal

Three connected improvements to the Providers feature:

1. **Display the custom upstream endpoint only when it is non-default** (e.g. Azure, OpenAI-compatible, self-hosted). For well-known providers whose endpoint equals the canonical default (Anthropic, OpenAI), hide it.
2. **Automatically load models and their costs** when a provider is created, with correct pricing per provider kind.
3. **Display models and API keys without tabs** — stacked sections in a single scrollable detail panel.

## Hard Constraints (from user)

- **No `ModelProvider` / domain entity changes.** No new kind, no new fields, **no migration.**
- **Azure stays `OpenAiCompatible`.** Azure is **inferred at runtime** by the endpoint host containing `azure.com`.
- **Azure model discovery = deployed models only.** The OpenAI `/models` endpoint returns far too many models for Azure; we must use deployed deployments only and **never fall back** to the full `/models` list for Azure.
- **Reuse the existing Azure deployment-fetch logic** in `ProviderClient` (`TryGetAzureDeploymentNamesAsync`).
- **Deployment type affects price** (Global Standard ≠ Data Zone Standard). It cannot be auto-detected with an api-key (control-plane/AAD concept), so it is a **request-time choice**, not persisted.

## Existing State (what we build on)

- `IModelProvider` (Domain): `Name`, `Endpoint` (Uri), `ApiKey`, `Kind` (`ModelProviderKind` = `Unknown`/`Anthropic`/`OpenAi`/`OpenAiCompatible`). `CreateClient()` → `IProviderClient`. **Unchanged by this work.**
- `IModelEndpoint` (Domain): `Model`, `Provider`, nullable `InputTokenCost` / `OutputTokenCost` (EUR per 1M tokens). **Unchanged.**
- `IProviderClient` (`Proxytrace.Infrastructure.Internal.ProviderClient`): `VerifyConnectionAsync`, `GetModelsAsync`. Already:
  - Tries `TryGetAzureDeploymentNamesAsync` (api-key, `/openai/deployments?api-version=2023-03-15-preview`) → deployment ids.
  - Falls back to `GetOpenAiModelNamesAsync` (the full `/models` list) when no Azure deployments.
  - Returns names only (`IReadOnlyList<IModel>`), **no pricing.**
- `ModelProvidersController`: provider/endpoint/key REST. `GET /api/providers/overview` returns the page payload. `GET /api/providers/{id}/available-models` returns discovered names.
- Frontend `features/providers/`: `Providers.tsx`, `ProviderDetail.tsx` (uses `Tabs` → `ModelsTab`/`KeysTab`), `ProviderDetailHeader.tsx` (always shows `provider.endpoint`), `AddProviderModal.tsx`, `providerMeta.ts`, query/mutation hooks.

## Decisions (from brainstorming)

- **Cost source:** external pricing feeds, not a bundled static catalog.
- **Model load behavior:** auto on provider create, plus a manual "reload" action.
- **Endpoint display:** show only when it differs from the kind's default.
- **Detail layout:** stacked sections (Models on top, API keys below), no tabs.
- **Azure pricing:** Azure Retail Prices API is authoritative for Azure; LiteLLM is the fallback for everything else. Manual per-endpoint override always wins.
- **Currency:** Azure feed returns EUR natively; LiteLLM (USD) is converted via a live FX rate (Frankfurter). Storage stays EUR / 1M tokens.

## Architecture

### Provider classification (runtime, no domain change)

A small helper (backend + frontend) decides routing without touching the entity:

- `IsAzure(provider)` ⇔ `provider.Endpoint.Host` contains `azure.com` (case-insensitive). Azure providers are stored as `OpenAiCompatible`.

### Model discovery (reuse + tighten existing logic)

`IProviderClient.GetModelsAsync` is changed to return a richer result instead of name-only `IModel`s, so pricing has what it needs:

```
record DiscoveredModel(
    string Name,            // what the endpoint/proxy uses (Azure: deployment id; else: model id)
    string PricingModelName // base model for catalog/retail lookup (Azure: deployments' `model`; else == Name)
);
```

- **Azure path** (`IsAzure`): reuse `TryGetAzureDeploymentNamesAsync`, extended to also read each deployment's base `model` field → `DiscoveredModel(id, model)`. **If the deployments fetch fails or is empty, return empty — never fall back to `/models`.**
- **Non-Azure path:** `GetOpenAiModelNamesAsync` → `DiscoveredModel(id, id)`.
- `available-models` controller endpoint + the frontend `useAvailableModels` adapt to the new shape (still surface `Name`).

### Pricing resolution

New `IPricingService` (Domain interface, Infrastructure impl). Input: provider + `DiscoveredModel` + optional `deploymentType` (Azure only). Output: `(InputTokenCost?, OutputTokenCost?)` in **EUR per 1M tokens**, nulls when unresolvable.

| Provider | Resolver | Source | Currency |
|---|---|---|---|
| Azure (`IsAzure`) | `AzureRetailPriceResolver` | Azure Retail Prices REST API (`https://prices.azure.com/api/retail/prices`), `currencyCode='EUR'`, `serviceName eq 'Cognitive Services'`, matched by base model + direction (input/output) + **deployment type** | native EUR |
| else | `LiteLlmCatalogResolver` | LiteLLM `model_prices_and_context_window.json` (USD/token), cached | USD/token × 1e6 × FX(USD→EUR) |
| any | manual edit (existing pricing PUT) | user input | EUR, **always wins** |

**Azure specifics:**
- **Deployment type** is supplied as a request-time parameter (`GlobalStandard` default; also `DataZoneStandard`, `Standard`). It maps to the retail `skuName` / `meterName` fragment (e.g. "Global", "Data Zone"). It is **not persisted** anywhere.
- Match on base model (`PricingModelName`) + direction + deployment-type fragment. Normalize the meter `unitOfMeasure` (Azure quotes per-1K tokens) to **per-1M EUR**.
- **Region is not handled** (api-key cannot reveal it). Global/Data-Zone meters are effectively region-uniform; if multiple rows match, pick the deployment-type-appropriate one. Anything ambiguous → cost `null`, user overrides manually.

**LiteLLM + FX:**
- Catalog fetched from a configurable URL, cached in memory (refresh daily / on miss), keyed by model name with `input_cost_per_token` / `output_cost_per_token` (USD).
- `eurPer1M = usdPerToken × 1_000_000 × fxUsdToEur`.
- FX from Frankfurter (`https://api.frankfurter.app/latest?from=USD&to=EUR`), no key, ECB daily, cached daily.
- **Fail-soft:** missing model or FX failure → cost `null`. Never store a wrong/unconverted number.

**Configuration** (appsettings, baked-in defaults): `Pricing:LiteLlmFeedUrl`, `Pricing:AzureRetailApiUrl`, `Pricing:FxApiUrl`.

### Components & boundaries

- `IPricingService` — single entry; owns resolver selection (`IsAzure` → Azure resolver, else LiteLLM). Caller (controller) is agnostic.
- `AzureRetailPriceResolver`, `LiteLlmCatalogResolver` — independent, each testable via a fake `HttpMessageHandler`.
- `IFxRateProvider` (USD→EUR, cached) — injected into the LiteLLM resolver, mockable.
- No domain types change; `DiscoveredModel` and `DeploymentType` are service-layer types.

## Auto-load on provider create

On `POST /api/providers`, after save (and on the explicit reload action):

1. `client.GetModelsAsync()` → `DiscoveredModel[]`.
2. For each, `IPricingService` resolves EUR/1M input + output (Azure auto-load uses default `GlobalStandard`).
3. Bulk-create `IModelEndpoint`s; skip names already present for the provider.

Runs **synchronously** in the create request (no SSE). The provider is saved first; auto-load is best-effort and must **not** fail the create. Frontend overview refetches and shows populated models.

New/changed API:
- `POST /api/providers` — triggers auto-load after save. Request unchanged (no new fields).
- `POST /api/providers/{providerId}/reload?deploymentType=GlobalStandard` — re-run discovery + pricing; create only missing endpoints; existing endpoints keep their (possibly manually overridden) pricing.

## Frontend changes

- **`providerMeta.ts`**: add `DEFAULT_ENDPOINT` per kind (Anthropic → `https://api.anthropic.com/v1`, OpenAI → `https://api.openai.com/v1`). Helpers `isDefaultEndpoint(kind, endpoint)` and `isAzureEndpoint(endpoint)` (host contains `azure.com`). **No new kind option.**
- **`ProviderDetailHeader.tsx`**: render the endpoint only when `!isDefaultEndpoint(kind, endpoint)`; show it prominently (labelled) for Azure / OpenAI-compatible / custom.
- **`ProviderDetail.tsx`**: drop `Tabs`; render `ModelsSection` then `KeysSection` stacked in the scroll panel, each with heading + count. Rename `ModelsTab`/`KeysTab` → `ModelsSection`/`KeysSection` (content largely unchanged; counts move into section headers).
- **Models section**: add "Reload models & prices" button. For Azure providers (`isAzureEndpoint`), show a **deployment-type selector** (Global Standard / Data Zone Standard / Standard) next to reload, passed to the reload call. Per-model manual price edit stays.
- **`AddProviderModal.tsx`**: hint that models + prices auto-load after creation. No kind/region fields added.
- Hooks: add `useReloadProvider(deploymentType)`; adapt `useAvailableModels` to the `DiscoveredModel` shape.

## Error handling

- All pricing/discovery fetches **fail-soft**: endpoints still created, costs left `null`. Azure discovery failure → empty list (no `/models` fallback), surfaced as a toast on reload.
- Auto-load failure during create must not fail the provider create.

## Testing

- Infra: `AzureRetailPriceResolver` (EUR passthrough, model+direction+deployment-type matching, per-1K→per-1M normalization, no-match → null), `LiteLlmCatalogResolver` (USD→EUR, missing model → null, FX failure → null), `IPricingService` routing by `IsAzure`. Fake `HttpMessageHandler`.
- Infra: `ProviderClient` Azure path returns deployment id + base model, and returns empty (no `/models` fallback) when deployments fail.
- API: create auto-populates endpoints; reload creates only missing; deployment-type param flows to Azure pricing. (Follow the `test` skill harness.)
- Frontend: `providerMeta` `isDefaultEndpoint` / `isAzureEndpoint` unit tests; `ProviderDetail` renders stacked sections (no tab roles).
- e2e (`create-e2e-test` skill): add provider → models appear with costs; custom-endpoint provider shows endpoint, default-endpoint provider hides it; detail panel has no tabs.

## Docs to update (same change)

- `docs/frontend.md` — providers detail layout change (no tabs), if documented there.
- `manual/guide/` (or `admin/`) providers page — auto-load, Azure deployed-models + deployment-type pricing, pricing-feed config.
- **No** `domain-entities.md` / `database.md` change (no domain/migration change).
- **No** SSE doc change (auto-load is synchronous).

## Out of scope (YAGNI)

- Any `ModelProvider`/`ModelEndpoint` schema or domain change.
- ARM/AAD-based Azure introspection for region or per-deployment SKU detection.
- Persisting deployment type (it is a transient reload parameter).
- Background/async model loading with SSE progress.
- A bundled offline price catalog; multi-currency display; historical pricing.
