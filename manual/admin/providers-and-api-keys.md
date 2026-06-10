# Providers & API Keys

Proxytrace routes captured traffic to upstream LLM providers and identifies clients with
its own API keys. This page covers the operator's view; for the client-side setup, see
[Proxy Setup](/guide/proxy-setup).

## Model providers, models, and endpoints

- **Model Provider** — an upstream OpenAI-compatible API such as OpenAI.
- **Model** — a specific model offered by a provider.
- **Model Endpoint** — a **model paired with a provider**, plus per-token costs
  (`InputTokenCost`, `OutputTokenCost`). Endpoints can calculate the cost of a call's token
  usage, which feeds the cost figures shown on traces and runs.

Manage these from the **Providers** area of the UI.

## Adding a provider — models & prices auto-load

When you add a provider, Proxytrace **discovers its models and fetches their prices
automatically**, so you usually start with a populated, priced model list. Each provider's
detail view shows its **Models** section (above its **API keys** section) with a per-model
input/output price. The **Reload models & prices** button re-runs discovery and **refreshes the
price of every model** (new and existing) from the catalogue, and a background service does the
same automatically on a configurable interval (default hourly — see
[Configuration](/admin/configuration)). Prices are managed entirely by Proxytrace — there is no
manual price entry.

The upstream **endpoint** is shown in the provider header only when it differs from the
provider kind's default (for example, the canonical `https://api.openai.com/v1` is hidden; a
custom or self-hosted endpoint is shown). The model
list is **pulled from the provider** — there is no manual "add model" control; use reload (or wait
for the periodic refresh) to pick up newly deployed models.

### Azure OpenAI

A provider whose endpoint host contains `azure.com` is treated as **Azure OpenAI**. For Azure
providers, discovery loads only the models you have actually **deployed** (it never falls back to
the full upstream model list).

### Where prices come from

All providers are priced from the **LiteLLM** model catalogue (quoted in USD) and converted to EUR
using **European Central Bank (ECB)** exchange rates. Azure providers prefer the catalogue's
`azure/<model>` entry, falling back to the bare model name. A model that isn't in the catalogue
loads without a price (shown as `—`).

Every stored price is normalised to **EUR per 1M tokens** and is refreshed from the catalogue on
each reload.

Operators can point the pricing feeds at different sources via the `Pricing` section of
`appsettings` (see [Configuration](/admin/configuration)): `Pricing:LiteLlmFeedUrl` and
`Pricing:FxApiUrl`.

## API keys

A Proxytrace **API Key** is the credential clients use against the OpenAI-compatible proxy.
Each key is tied to:

- a **Project** — so captured traffic lands in the right tenant, and
- a **Model Provider** — so the proxy knows which upstream to forward to.

The proxy also accepts the **upstream provider's own API key** as the inbound bearer, so
existing clients can migrate by changing only the base URL. The upstream key identifies only
the provider — the project is taken from the **project slug in the request path**
(`/{project}/openai/v1/…`, where the slug is derived from the project name). This means the
same upstream key can be reused across projects, disambiguated by the path. If the same string
is valid as both a Proxytrace key and an upstream key, the Proxytrace key wins.

### Issuing a key

1. Open **Providers**.
2. Select the provider the key should route to.
3. Generate the key and distribute it to the client team. Treat it as a secret.

Clients then set this key plus the proxy base URL in their OpenAI-compatible client — see
[Proxy Setup](/guide/proxy-setup).

## Project system endpoint

Each **Project** references one **system endpoint** — the model endpoint used by built-in
system agents (for example, agent-name generation and optimizers). Configure it so those
internal features have a model to call.
