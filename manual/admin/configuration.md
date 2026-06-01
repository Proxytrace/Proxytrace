# Configuration

Proxytrace is configured through standard ASP.NET Core settings files in the
`Proxytrace.Api` project.

## Settings files

- `Proxytrace.Api/appsettings.json` — default configuration.
- `Proxytrace.Api/appsettings.development.json` — development overrides.

Environment variables and the usual ASP.NET Core configuration providers also apply and
override file values.

Licensing is configured separately, primarily through environment variables — see
[Licensing](/admin/licensing).

## Common settings

### Database connection string

Persistent storage is PostgreSQL only. Set it under `ConnectionStrings:Default`:

```json
{
  "ConnectionStrings": {
    "Default": "Host=localhost;Port=5432;Database=proxytrace;Username=proxytrace;Password=proxytrace"
  }
}
```

In kiosk mode (`Kiosk:Enabled=true`) the connection string is ignored and in-memory storage is
used instead. See [Database](/admin/database) for details.

### Frontend origin (CORS)

The API allows the frontend origin for CORS. By default it is `http://localhost:4201`;
override with `Frontend:AllowedOrigin`:

```json
{
  "Frontend": {
    "AllowedOrigin": "https://your-frontend-host"
  }
}
```

## Kiosk mode

Kiosk mode (`Kiosk:Enabled=true`) runs Proxytrace in-memory and auto-seeds a rich demo
dataset (the "Showcase Project" with sample agents, traces, test suites and proposals) on
startup. It is intended for demos and walkthroughs.

Kiosk is single-process: it does **not** require Redis. Captured-call ingestion runs over an
in-process channel (`Messaging:Provider=InProcess`, forced automatically in kiosk regardless of
config), and the ingestion worker runs in-process to persist those calls into the in-memory demo
DB. The split/Redis transport is only for the standalone-proxy production deployment.

```json
{
  "Kiosk": {
    "Enabled": true
  }
}
```

### Functional kiosk (real LLM endpoint)

By default the seeded providers carry no credentials, so Tracey chat and test runs cannot
reach a real model. To make the kiosk **fully functional**, add a `Kiosk:Endpoint` section
with a real provider endpoint, API key and model — typically in
`Proxytrace.Api/appsettings.local.json` so the secret stays out of source control:

```json
{
  "Kiosk": {
    "Enabled": true,
    "Endpoint": {
      "BaseUrl": "https://api.openai.com/v1",
      "ApiKey": "sk-...",
      "Model": "gpt-4o",
      "Kind": "OpenAi",
      "ProviderName": "Kiosk Provider",
      "InputTokenCost": 0.0000025,
      "OutputTokenCost": 0.00001
    }
  }
}
```

When this section is present, kiosk seeding creates a real model provider, model and
endpoint, makes it the project's **system endpoint** (which powers Tracey chat), and routes
all demo agents through it so test runs call the real model. The **Tracey AI** assistant also
becomes visible and usable in the kiosk — her chat is the one write the read-only demo permits.
Each Tracey exchange is captured through the in-process ingestion pipeline and shows up as a new
trace attributed to the Tracey system agent.

- `BaseUrl`, `ApiKey` and `Model` are **required**. If the section is present but any of them
  is missing or invalid, the API fails fast on startup with a clear error.
- `Kind` is one of `OpenAi`, `Anthropic`, or `OpenAiCompatible` (default `OpenAi`).
- `ProviderName`, `InputTokenCost` and `OutputTokenCost` are optional.

If `Kiosk:Endpoint` is omitted, the kiosk still seeds the full demo dataset, but with
credential-less providers (LLM calls will not succeed); **Tracey stays hidden** in that case,
since she has no real model to call.

## Demo data

Local dev mode does not auto-seed in every flow. Use the **`/setup`** page (or the setup
endpoint) to populate demo data into an empty database.

## Security headers

The API emits a strict Content-Security-Policy and related headers on every response (the
nginx deployment sets equivalent headers). This is why the bundled manual is served from a
path the CSP explicitly allows — see [Deployment](/admin/deployment).

## Next step

Choose and configure a database — see [Database](/admin/database).
