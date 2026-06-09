# Providers Story — Design

**Date:** 2026-06-09
**Status:** Approved (design), pending implementation plan
**Branch:** feature/refactor

## Goal

Three connected improvements to the Providers feature:

1. **Display the custom upstream endpoint only when it is non-default** (e.g. Azure, OpenAI-compatible, self-hosted). For well-known providers whose endpoint equals the canonical default (Anthropic, OpenAI), hide it.
2. **Automatically load models and their costs** when a provider is created, with correct pricing per provider kind.
3. **Display models and API keys without tabs** — stacked sections in a single scrollable detail panel.

## Existing State (what we build on)

- `IModelProvider` (Domain): `Name`, `Endpoint` (Uri), `ApiKey`, `Kind` (`ModelProviderKind`). Factory delegates `CreateNew` / `CreateExisting`. `CreateClient()` → `IProviderClient`.
- `ModelProviderKind`: `Unknown`, `Anthropic`, `OpenAi`, `OpenAiCompatible`.
- `IModelEndpoint` (Domain): `Model`, `Provider`, nullable `InputTokenCost` / `OutputTokenCost` (EUR per 1M tokens), `CalculateCost(usage)`.
- `IProviderClient` (Infrastructure `ProviderClient`): `VerifyConnectionAsync`, `GetModelsAsync`. Already discovers OpenAI model names, and Azure deployment names via the unauthenticated-list deployments endpoint (`/openai/deployments?api-version=…`). **Returns names only, no pricing.**
- `ModelProvidersController`: REST for providers, model endpoints (`available-models`, CRUD), API keys. `GET /api/providers/overview` returns the whole page payload (`ProvidersOverviewDto`).
- Frontend `features/providers/`: `Providers.tsx` (master/detail), `ProviderDetail.tsx` (uses `Tabs` → `ModelsTab` / `KeysTab`), `ProviderDetailHeader.tsx` (always shows `provider.endpoint`), `AddProviderModal.tsx`, `providerMeta.ts` (`PROVIDER_KIND_OPTIONS`, `kindLabel`, `kindColor`, `maskKey`), query/mutation hooks.

## Decisions (from brainstorming)

- **Cost source:** external pricing feeds, **not** a bundled static catalog.
- **Model load behavior:** auto on provider create (plus a manual "reload" action).
- **Endpoint display:** show only when it differs from the kind's default.
- **Detail layout:** stacked sections (Models on top, API keys below), no tabs.
- **Azure pricing:** Azure Retail Prices API is authoritative for Azure; LiteLLM is the fallback for everything else. Manual per-endpoint override always wins.
- **Currency:** Azure feed returns EUR natively; LiteLLM (USD) is converted via a live FX rate (Frankfurter). Storage stays EUR / 1M tokens — no cost-field schema change.

## Architecture

### Pricing resolution

New `IPricingService` (Domain interface, Infrastructure impl). Given a provider + model name, returns `(InputTokenCost?, OutputTokenCost?)` in **EUR per 1M tokens**, or nulls when unresolvable.

Resolver order, by provider kind:

| Provider kind | Resolver | Source | Currency handling |
|---|---|---|---|
| `Azure` | `AzureRetailPriceResolver` | Azure Retail Prices REST API (`https://prices.azure.com/api/retail/prices`), `currencyCode='EUR'`, filtered by model + deployment type + region | native EUR, no FX |
| `OpenAi` / `Anthropic` / `OpenAiCompatible` | `LiteLlmCatalogResolver` | LiteLLM `model_prices_and_context_window.json` (USD per token), cached | USD/token × 1e6 × FX(USD→EUR) |
| any | manual edit (existing endpoint pricing PUT) | user input | EUR, **always wins** |

**Azure specifics:**
- Deployment **type** (Global / Data Zone / Regional) is read from the Azure deployments listing `sku.name` (e.g. `Standard`, `GlobalStandard`, `DataZoneStandard`) already fetched during model discovery.
- **Region** comes from an optional new provider field `AzureRegion` (`armRegionName`, e.g. `westeurope`). The deployments API does not expose the resource region without ARM auth, so this is a manual override.
- The retail query filters `serviceName eq 'Cognitive Services'` (Azure OpenAI meters), matches the model + direction (input/output) + deployment type in `skuName`/`meterName`, and `armRegionName` when set. If no confident match → cost `null`; the user sets it manually.

**LiteLLM + FX:**
- Catalog fetched from a configurable URL, cached in memory (refresh daily / on miss). Keyed by model name; entries give `input_cost_per_token` / `output_cost_per_token` (USD).
- Convert: `eurPer1M = usdPerToken × 1_000_000 × fxUsdToEur`.
- FX from Frankfurter (`https://api.frankfurter.app/latest?from=USD&to=EUR`), no key, ECB daily; cached daily.
- **Fail-soft:** if the catalog lacks the model, or FX fetch fails, the cost is left `null`. Never store a wrong/unconverted number.

**Configuration** (appsettings, all with baked-in defaults):
- `Pricing:LiteLlmFeedUrl`
- `Pricing:AzureRetailApiUrl`
- `Pricing:FxApiUrl`

### Domain changes

- `ModelProviderKind` gains `Azure`.
- `IModelProvider` gains optional `string? AzureRegion` (nullable; only meaningful when `Kind == Azure`). Updates both factory delegates (`CreateNew`, `CreateExisting`), the `ModelProvider` impl + generator, the EF entity/config, and a **migration**.
- `IPricingService` interface in Domain (`Proxytrace.Domain/ModelProvider/IPricingService.cs`), implementation + HTTP clients in Infrastructure, registered in `Proxytrace.Infrastructure/Module.cs`.

### Auto-load on provider create

On `POST /api/providers`, after the provider is saved (and on a new explicit reload action):

1. `client.GetModelsAsync()` discovers model names (+ Azure deployment sku data).
2. For each model, `IPricingService` resolves EUR/1M input + output cost.
3. Bulk-create `IModelEndpoint`s (skip names that already exist for the provider).

Runs **synchronously** within the create request (no SSE). Returns the saved provider; the frontend's overview query refetches and shows populated models. A **"Reload models & prices"** action re-runs steps 1–3 later (creating only missing endpoints; existing endpoints keep their — possibly manually overridden — pricing).

New/changed API:
- `POST /api/providers` — extended to trigger auto-load; request gains optional `azureRegion`.
- `POST /api/providers/{providerId}/reload` — re-run discovery + pricing.
- `CreateModelProviderRequest` / `UpdateModelProviderRequest` / `ModelProviderDto` gain `AzureRegion`.

### Frontend changes

- **`providerMeta.ts`**: add `DEFAULT_ENDPOINT` map per kind (Anthropic → `https://api.anthropic.com/v1`, OpenAI → `https://api.openai.com/v1`; Azure / OpenAI-compatible have no default). Add `Azure` to `PROVIDER_KIND_OPTIONS` + `kindColor`. Helper `isDefaultEndpoint(kind, endpoint)`.
- **`ProviderDetailHeader.tsx`**: render the endpoint only when `!isDefaultEndpoint(kind, endpoint)`; show it prominently (labelled) for custom/Azure. Show `AzureRegion` when present.
- **`ProviderDetail.tsx`**: drop `Tabs`. Render `ModelsSection` then `KeysSection` stacked in the scroll panel, each with its own heading + count. Rename `ModelsTab`/`KeysTab` → `ModelsSection`/`KeysSection` (content largely unchanged; remove tab-count badges, keep counts in section headers). Add a "Reload models & prices" button in the Models section header.
- **`AddProviderModal.tsx`**: when `kind == Azure`, show an optional **Azure region** field and a hint that models + prices auto-load after creation.
- Query/mutation hooks: add `useReloadProvider`; thread `azureRegion` through create/update.

## Components & boundaries

- `IPricingService` — single entry point; owns resolver selection. Consumers (controller) don't know about Azure vs LiteLLM.
- `AzureRetailPriceResolver`, `LiteLlmCatalogResolver` — independent, each testable with a fake `HttpMessageHandler`.
- `IFxRateProvider` — small interface (USD→EUR), cached; injected into the LiteLLM resolver so it's mockable.
- Catalog + FX caching live behind their resolvers; the service is stateless from the caller's view.

## Error handling

- Any upstream/pricing fetch failure is **fail-soft**: endpoints are still created, costs left `null`. Discovery failure on reload surfaces a toast but does not delete existing endpoints.
- Auto-load failure during create must **not** fail the provider create — the provider is saved first, then best-effort population.

## Testing

- Domain/Infra: `AzureRetailPriceResolver` (EUR passthrough, sku/direction/region matching, no-match → null), `LiteLlmCatalogResolver` (USD→EUR conversion, missing model → null, FX failure → null), `IPricingService` resolver selection by kind. Fake `HttpMessageHandler`.
- API: create-with-auto-load populates endpoints; reload endpoint creates only missing; `AzureRegion` round-trips. (Follow the `test` skill harness.)
- Frontend: `providerMeta` `isDefaultEndpoint` unit tests; `ProviderDetail` renders stacked sections (no tab roles).
- e2e (`create-e2e-test` skill): add provider → models appear with costs; Azure provider shows endpoint + region; detail panel has no tabs.

## Docs to update (same change)

- `docs/domain-entities.md` — new `AzureRegion` field + `Azure` kind on the provider entity.
- `docs/database.md` — the `AzureRegion` migration.
- `docs/frontend.md` — providers detail layout change (no tabs) if it documents the page.
- `manual/guide/` (or `admin/`) providers page — auto-load, Azure region/pricing, pricing-feed config.
- SSE doc: **no change** (auto-load is synchronous).

## Out of scope (YAGNI)

- ARM-based Azure resource introspection for automatic region detection (manual `AzureRegion` field instead).
- Background/async model loading with SSE progress.
- A bundled offline price catalog.
- Multi-currency display or per-user currency preference (stays EUR).
- Historical / time-versioned pricing.
