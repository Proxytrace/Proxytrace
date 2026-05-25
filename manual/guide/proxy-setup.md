# Proxy Setup

Proxytrace captures traffic by acting as an **OpenAI-compatible proxy**. Your agent keeps
talking to what looks like the OpenAI API; Proxytrace records the interaction and forwards
it to the real provider.

## What you change

Only two things in your client:

1. **Base URL** — point it at the Proxytrace proxy endpoint instead of the provider's.
2. **API key** — use a **Proxytrace-issued API key** (see below) instead of the provider
   key. Proxytrace maps the key to the correct project and upstream provider.

No SDK swap, no code changes beyond configuration.

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
    base_url="https://your-proxytrace-host/v1",  # Proxytrace proxy endpoint
    api_key="pt-...",                             # Proxytrace-issued key
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
