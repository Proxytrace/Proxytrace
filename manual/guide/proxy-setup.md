# Proxy Setup

Proxytrace captures traffic by acting as an **OpenAI-compatible proxy**. Your agent keeps
talking to what looks like the OpenAI API; Proxytrace records the interaction and forwards
it to the real provider.

## What you change

Only two things in your client:

1. **Base URL** — point it at the Proxytrace proxy endpoint instead of the provider's.
2. **API key** — either a **Proxytrace-issued API key** (see below) **or your existing
   upstream provider key**. Proxytrace accepts both and maps the call to the right project
   and upstream provider.

No SDK swap, no code changes beyond configuration.

### Which key to use

- **Proxytrace-issued key (recommended)** — carries its own project, so attribution is
  automatic and the key can be revoked per client. The project segment in the URL is optional;
  if you include it, it must match the key's project.
- **Upstream provider key** — lets you migrate an existing app onto Proxytrace by changing
  only the base URL. The key identifies the upstream provider; the **project comes from the URL
  path** (see below), so you must include the project segment. If the same upstream key is used
  by several projects, the path is what disambiguates them.
- **Collisions.** If the same string is valid as both a Proxytrace key and an upstream
  provider key, the Proxytrace key wins.

### The project segment

The proxy base URL carries the project as the first path segment:

```
https://your-proxytrace-host/{project}/openai/v1
```

`{project}` is the **slug** of the project name — lower-cased, with non-alphanumeric characters
dropped and spaces turned into hyphens. For example, project **"Showcase Project"** →
`showcase-project`. The slug is derived automatically; there is nothing to configure.

The legacy `https://your-proxytrace-host/openai/v1` form (no project segment) still works for
Proxytrace-issued keys, since the key already carries its project.

## Create an API key

A Proxytrace **API Key** is tied to a **Project** and a **Model Provider**. Create one from
the Providers area of the UI (operators can also manage these — see
[Providers & API Keys](/admin/providers-and-api-keys)).

1. Open **Providers**.
2. Choose the upstream provider the key should route to (e.g. OpenAI, Anthropic).
3. Generate a key and copy it — treat it like a secret.

## Point your client at the proxy

Example using the OpenAI Python SDK:

```python
from openai import OpenAI

client = OpenAI(
    # Project slug + /openai/v1. Works with a Proxytrace key or your upstream provider key.
    base_url="https://your-proxytrace-host/showcase-project/openai/v1",
    api_key="pt-...",  # Proxytrace-issued key, or your upstream provider key
)

resp = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello"}],
)
```

The call runs exactly as before — but it is now captured. Open **Traces** to confirm it
arrives. See [Capturing Traces](/guide/capturing-traces).

## Next step

Once traffic flows, learn how [traces are captured and explored](/guide/capturing-traces).
