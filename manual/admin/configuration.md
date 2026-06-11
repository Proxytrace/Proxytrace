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

### Model pricing feeds

Proxytrace auto-fetches model prices when a provider is added (and when its **Reload models &
prices** button is used) — see [Providers & API Keys](/admin/providers-and-api-keys). The
source feeds are configurable under `Pricing`:

```json
{
  "Pricing": {
    "LiteLlmFeedUrl": "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json",
    "FxApiUrl": "https://api.frankfurter.app/latest",
    "RefreshIntervalHours": 1
  }
}
```

- `LiteLlmFeedUrl` — the LiteLLM model-price catalogue (USD) used for all providers (Azure providers prefer its `azure/<model>` entries).
- `FxApiUrl` — the ECB exchange-rate source used to convert USD prices to EUR.
- `RefreshIntervalHours` — how often the background service re-resolves prices for every provider's models (default `1`; minimum 1 hour).

All prices are stored as EUR per 1M tokens. A background service refreshes them on the configured
interval, and the **Reload models & prices** button triggers a refresh on demand.

### Update notifications

Proxytrace checks once a day whether a newer release is available and, if so, shows admins a
dismissible notice linking the release notes. The check polls the public GitHub releases feed
(`GET /api/updates` exposes the result to admins) and never sends any data beyond the request
itself; the only thing the feed's host observes is your server's IP address. Failures are
silent and never affect the application.

```json
{
  "Updates": {
    "Enabled": true,
    "ManifestUrl": "https://api.github.com/repos/Proxytrace/Proxytrace/releases/latest",
    "CheckIntervalHours": 24
  }
}
```

- `Enabled` — set `false` to disable the check entirely (no outbound requests, e.g. for
  air-gapped installs).
- `ManifestUrl` — endpoint returning the latest release in the GitHub `releases/latest` shape.
- `CheckIntervalHours` — poll interval (default `24`, minimum 1).

The check is automatically disabled in kiosk mode and for development builds. The running
version is also reported by `GET /api/config` (unauthenticated) and shown on the dashboard.

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

### Interactive kiosk (real LLM endpoint)

By default, kiosk is **read-only**: the seeded providers carry no credentials, so you can
browse the demo dataset but cannot run test suites, generate optimization proposals, or use
Tracey chat. To switch kiosk into **interactive mode**, add a `Kiosk:Endpoint` section with a
real provider endpoint, API key, and model — typically in
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

When `Kiosk:Endpoint` is present, kiosk becomes fully read-write for a single user:

- **Run test suites and evaluations** against the demo agents (real model calls are made).
- **Generate optimization proposals** and inspect the Tracey-produced rationale.
- **Create, edit, and delete** agents, test suites, and providers — the full UI is unlocked.
- **Chat with Tracey** — the AI assistant becomes visible and usable. Each exchange is
  captured through the in-process ingestion pipeline and shows up as a new trace attributed
  to the Tracey system agent.

All data remains **in-memory only** and is lost when the process restarts. Interactive kiosk
is intended for a single user or a private hands-on demo — it is not designed for a shared
public instance.

The seeded model provider, model, and endpoint are created from the `Kiosk:Endpoint` values
and become the project's **system endpoint** powering all interactive features.

- `BaseUrl`, `ApiKey` and `Model` are **required**. If the section is present but any of them
  is missing or invalid, the API fails fast on startup with a clear error.
- `Kind` is one of `OpenAi` or `OpenAiCompatible` (default `OpenAi`).
- `ProviderName`, `InputTokenCost` and `OutputTokenCost` are optional.

If `Kiosk:Endpoint` is omitted, the kiosk seeds the full demo dataset with credential-less
providers (LLM calls will not succeed); interactive features including Tracey stay hidden
since there is no real model to call.

## Demo data

Local dev mode does not auto-seed in every flow. Use the **`/setup`** page (or the setup
endpoint) to populate demo data into an empty database.

## Optimization theory validation

Every [optimization theory](/guide/optimization-theories) is validated by running its target
test suite with the proposed change applied — i.e. **real LLM calls that cost money and
time**. Because theories can be submitted by users, Tracey AI, and external API callers, the
validation pipeline is rate-limited so an open submission endpoint cannot run away with
spend:

- **Deduplication** — a theory identical to one already in flight, or to an already-decided
  proposal (until the 3-completed-group "fresh evidence" threshold), is suppressed before any
  run starts.
- **Per-project backlog cap** — validation runs one theory at a time, so the queue is what
  grows under load. Each project may have at most a fixed number of **in-flight** theories
  (queued *or* validating — currently **20**) at once. Submissions beyond that are rejected
  with HTTP `429 Too Many Requests` and should be retried once the backlog drains.

Validation runs are flagged as system runs, so they never recursively trigger further
optimization. Keep an eye on provider spend when many theories are submitted in a short
window.

## Security headers

The API emits a strict Content-Security-Policy and related headers on every response (the
nginx deployment sets equivalent headers). This is why the bundled manual is served from a
path the CSP explicitly allows — see [Deployment](/admin/deployment).

The policies default to safe values but can be overridden per environment under
`SecurityHeaders`. `ContentSecurityPolicy` applies to the app/API; `DocsContentSecurityPolicy`
applies to the bundled manual at `/docs` (which needs a slightly relaxed `script-src`):

```json
{
  "SecurityHeaders": {
    "ContentSecurityPolicy": "default-src 'self'; ...",
    "DocsContentSecurityPolicy": "default-src 'self'; script-src 'self' 'unsafe-inline'; ..."
  }
}
```

Empty values are rejected on startup.

## Endpoint tuning

A few API limits are configurable; the defaults are sensible and rarely need changing. Invalid
values (e.g. a minimum above its maximum) fail fast on startup.

Search request validation bounds live under `Search:Requests`:

```json
{
  "Search": {
    "Requests": {
      "MinQueryLength": 2,
      "MaxQueryLength": 200,
      "MinSnippetLength": 20,
      "MaxSnippetLength": 1000
    }
  }
}
```

Dashboard statistics page sizes (used when a request omits `recentTraceCount`/`agentLimit`, and
as upper clamps) live under `Statistics`:

```json
{
  "Statistics": {
    "DefaultRecentTraceCount": 6,
    "MaxRecentTraceCount": 50,
    "DefaultAgentLimit": 10,
    "MaxAgentLimit": 100
  }
}
```

## Next step

Choose and configure a database — see [Database](/admin/database).
