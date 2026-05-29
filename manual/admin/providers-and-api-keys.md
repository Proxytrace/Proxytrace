# Providers & API Keys

Proxytrace routes captured traffic to upstream LLM providers and identifies clients with
its own API keys. This page covers the operator's view; for the client-side setup, see
[Proxy Setup](/guide/proxy-setup).

## Model providers, models, and endpoints

- **Model Provider** — an upstream API such as OpenAI or Anthropic.
- **Model** — a specific model offered by a provider.
- **Model Endpoint** — a **model paired with a provider**, plus per-token costs
  (`InputTokenCost`, `OutputTokenCost`). Endpoints can calculate the cost of a call's token
  usage, which feeds the cost figures shown on traces and runs.

Manage these from the **Providers** area of the UI.

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
