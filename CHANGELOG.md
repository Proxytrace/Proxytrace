# Changelog

All notable, user-facing changes to Proxytrace are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions
follow [Semantic Versioning](https://semver.org). Ongoing work is collected under
`[Unreleased]`; cutting a release moves that section under the new version heading
(see `docs/releasing.md`).

## [Unreleased]

### Added

- **Periodic test-run scheduling (Enterprise).** Test suites can now be run automatically on a
  recurring interval against a fixed set of model endpoints. Schedules are managed over a REST API
  (list, create, update, delete, and run-now), with each schedule carrying a summary of its most
  recent runs. Creating and managing schedules requires an Enterprise license; existing schedules
  stay listable after a downgrade.

- **The Traces page empty state now shows how to ingest.** Instead of only a link to the manual,
  an empty Traces view displays the project's actual OpenAI `base_url` and a copy-paste quick-start
  snippet (Python / TypeScript / C# / curl), so you can wire up the proxy without leaving the page.
  A filtered-but-empty view shows a distinct "no match" hint instead.

- **The manual's Proxy Setup page now shows your instance's real endpoint.** When the manual is
  read from a running Proxytrace instance (served at `/docs`), the OpenAI `base_url` box fills in
  the operator's actually configured proxy host instead of a placeholder, and a clearer "what the
  proxy endpoint is" section explains where to copy the ready-to-use endpoint in the app.

- **Tracey can now curate test suites from traces.** The in-app AI assistant can build a new test
  suite for an agent from captured traces, add traces to an existing suite as test cases, set a
  case's expected output, and remove cases — closing the curate→benchmark→run loop entirely in
  chat. She can also **cancel an in-progress test run**. All are confirmation-gated writes.

### Changed

- **The dashboard and traces views stay fast with very large trace volumes.** Trace statistics
  (token usage, latency percentiles, call trends, per-agent rollups, live telemetry) now aggregate
  inside the database instead of loading every matching call into memory, and the traces table
  reads a lightweight row projection instead of the full request/response payload of each call.
- **Trace ingestion keeps up under high proxy load.** The ingestion worker now persists captured
  calls in parallel (tunable via `Messaging:MaxConcurrency`, Redis deployments only) and reads the
  stream in larger batches. The dashboard's **Queue depth** now reflects the real ingestion backlog,
  so a consumer falling behind is visible before unprocessed traces are dropped.
- **Test-run live updates scale with many concurrent runs.** The test-result event broadcaster now
  routes each event directly to the subscribers of that run/group instead of scanning every live
  subscriber on the instance, so a busy multi-run period no longer does work proportional to the
  total number of open streams per event.

### Security

- **Test-support and `/seed` endpoints are no longer reachable on real deployments.** The e2e helper
  endpoints (including a destructive `POST /api/test/reset` that wiped all run data, and the
  per-controller `/seed` injectors) were exposed to any authenticated user in production. They are
  now gated behind a `TestOnlyEndpoint` guard (Development env or `TestSupport:Enabled`), so a
  normal user can no longer wipe or fabricate data.
- **Proxy API keys are now generated with a cryptographic RNG** instead of a GUID, and the
  long-lived session token is accepted in the `?access_token` URL only on SSE (`…/stream`) routes
  rather than on every request — closing a token-in-URL leakage path. Client error reporting
  (`POST /api/errors`) now requires authentication.

### Fixed

- **Deleting a model provider no longer destroys its traces and test runs.** A provider delete used
  to cascade through its endpoints and silently hard-delete every `AgentCall`/`TestRun` that
  referenced them. Providers now archive (soft-delete) like endpoints do, so the history is preserved
  while the provider disappears from the UI.
- **Captured traces are no longer dropped on a transient database hiccup.** The ingestion worker
  acknowledged every message even when persisting it failed; a brief DB outage or a write race could
  lose a trace permanently. Failed writes are now retried (with an attempt cap) and only acknowledged
  once they succeed. A normal completion whose text happens to contain `data: ` is also no longer
  mis-parsed as a streamed response.
- **One failing test case no longer fails the whole test run.** A single flaky/erroring case (e.g. a
  timed-out LLM call) aborted the entire run and every sibling case; failures are now isolated so the
  rest of the run completes. Optimization A/B validation also ignores partial runs so a proposal is
  never spawned from incomplete evidence.
- **Real-time (SSE) streams no longer leak server resources.** Streams for already-finished runs and
  groups left a subscription registered forever; subscriptions are now always cleaned up, capped, and
  kept alive with a heartbeat so dead connections are detected.
- **Tracey's "remove test case" tool no longer renders a broken result card.** Removing a case
  from a suite via the assistant dropped the updated suite returned by the backend (the API call
  was typed as returning nothing), so the follow-up card showed empty. The updated suite is now
  carried through and rendered correctly.

- Listing models through the proxy against an **Azure OpenAI** upstream
  (`GET /openai/v1/models`, e.g. `client.models.list()`) returned an empty list, because Azure
  exposes usable models as *deployments* rather than through an OpenAI-style `/models` route.
  The proxy now detects an Azure upstream and returns its deployments as the model list.

- The proxy forwarded bodyless requests (e.g. `GET /models`, `DELETE`) with an empty body and
  `Content-Length: 0`, which some strict OpenAI-compatible upstreams reject. It now attaches a
  request body only when one is present.

- The project segment in the proxy URL (`/{project}/openai/v1/…`) is now matched
  case-insensitively, so a base URL like `…/Development/openai/v1` resolves the **Development**
  project instead of returning **401 Unauthorized**.

### Security

- Updated `dompurify` (the HTML sanitizer behind the message HTML view and the search-snippet
  preview) to 3.4.10, picking up upstream sanitization-bypass fixes, and refreshed the frontend
  dev toolchain so `npm audit` reports no known vulnerabilities.

## [1.0.3] - 2026-06-12

### Added

- "How to wire the proxy?" documentation link on the Traces page empty state.

### Changed

- The **Tracey AI** assistant is now an Enterprise feature. On the Free tier the sidebar
  entry is locked and the Tracey page shows an upgrade prompt; the Tracey API endpoints
  respond with HTTP 402.

### Fixed

- Upgrade/pricing links (upgrade placeholder, upgrade dialog, docs) pointed at
  `proxytrace.dev/pricing` instead of the correct `proxytrace.dev/#pricing` anchor.

- The ingestion endpoint shown in the setup wizard and on the API-keys page pointed at the
  web UI port instead of the ingestion proxy (e.g. `:5101` instead of `:5102` in the Docker
  deployment), where OpenAI calls fail with `405 Not Allowed`. The backend now advertises
  the proxy's public URL (`Proxy:PublicBaseUrl`; in Docker `PROXYTRACE_PROXY_PUBLIC_URL`,
  default `http://localhost:5102`) and the UI displays that.

## [1.0.2] - 2026-06-12

### Changed

- **Faster multi-architecture release builds** — the release pipeline now builds the
  `linux/amd64` and `linux/arm64` container images more efficiently, shortening release
  times. No change to the published images or runtime behavior.

## [1.0.1] - 2026-06-12

### Fixed

- **ARM64 container images** — release images are now published for both `linux/amd64`
  and `linux/arm64`, so `docker compose up` works on Apple Silicon (and other arm64
  hosts) without the `no matching manifest for linux/arm64/v8` error.

## [1.0.0] - 2026-06-12

First stable release. Consolidates everything from the `1.0.0-rc.1` and
`1.0.0-rc.2` prereleases.

### Added

- **Brand mark** — new "Scope" logo and app icons: a gold trace pulse over an
  oscilloscope graticule with a teal live cursor.
- **Trace capture** — OpenAI-compatible ingestion proxy that records every LLM
  interaction (requests, responses, tool calls, token usage, cost, latency) with
  zero agent code changes.
- **Projects, agents & API keys** — organize captured traffic per project and agent,
  authenticated with per-agent proxy API keys.
- **First-run setup wizard** — guided onboarding (provider → model → project) ending in
  per-language quick-start examples (Python, TypeScript, C#, curl); clients keep their
  upstream provider API key and swap only the base URL.
- **Dashboard & statistics** — live telemetry, token/cost breakdowns, latency and
  pass-rate trends per agent, model, and project.
- **Test suites & evaluators** — curate captured traces into benchmark suites and
  judge them with configurable evaluators (including agentic and custom evaluators).
- **Test runs** — execute suites against any model endpoint with a live, streaming
  results view and per-evaluator progress.
- **Optimization loop** — data-driven optimization theories, A/B validation runs,
  and reviewable improvement proposals.
- **Tracey** — built-in AI assistant with access to your traces and the manual.
- **Authentication** — local accounts or OIDC single sign-on (Enterprise).
- **Licensing** — Free tier built in; Enterprise features unlocked with a license key.
- **Self-hosted deployment** — versioned container images on GHCR with a downloadable
  Docker Compose artifact; database migrations apply automatically on upgrade.
- **Update notifications** — daily check against the public release feed; admins see a
  dismissible in-app notice when a newer version is available (opt-out via `Updates:Enabled`).
- **User & operator manual** — bundled at `/docs`, searchable, with admin guides.
- **License management in the UI** — a license key can now be activated without a restart:
  the setup wizard's Welcome step offers a *"Have a license key?"* field, and a new
  **Settings → License** page lets admins validate a key (dry run showing tier, customer,
  and expiry), activate it, force a license-server re-check, or remove it. A key activated
  in the UI is stored in the database and takes precedence over the `PROXYTRACE_LICENSE`
  environment variable.
- **Zero-configuration Docker install** — `docker compose up -d` now works without any
  `.env` file: the internal-only Postgres password defaults, the session signing key is
  generated on first start and persisted in a new `appdata` volume (sessions survive
  container recreation), and without a license Proxytrace runs the Free tier. All `.env`
  settings remain available as overrides.
- **Adoption tracking for promoted proposals** — a promoted proposal now waits in
  *"Promoted — awaiting adoption"* and flips to **Adopted** automatically when the exact
  change shows up in the agent's live traffic (new prompt/tool version, or calls arriving on
  the proposed model endpoint); auto-adoptions link the detected agent version ("Adopted in
  v{N}"). A **Mark adopted** button covers tweaked or undetectable adoptions.
- **Handoff package on promote** — copy buttons for the proposed prompt / tools JSON / model
  name, a downloadable markdown "apply this change" doc with the A/B evidence, and a
  machine-readable artifact endpoint (`GET /api/proposals/{id}/artifact`) for scripted
  workflows.
- **Generate JSON schema from an example** — the JSON Schema Match evaluator form can now
  infer a draft 2020-12 schema from a pasted example JSON value (every observed key becomes
  required; loosen by hand where needed).

### Changed

- **An invalid license no longer prevents startup** — a malformed/expired/rejected
  `PROXYTRACE_LICENSE` previously crashed the container; Proxytrace now boots with
  Free-tier entitlements, shows a red "license invalid" banner with the rejection reason,
  and the key can be fixed under Settings → License without a restart.
- **The license offline-grace cache is now persisted across container recreations**
  (in the new `appdata` volume), so the offline grace window is anchored correctly.
- **Promote is honest now** — Proxytrace is an observing proxy and cannot change your
  agent's code; the UI no longer claims a promoted change "has been applied to the agent".
  Proposal status changes are validated server-side (illegal transitions return 409).
- **Theory validation is now statistically gated** — an A/B pass-rate improvement only
  produces an optimization proposal when it is significant (two-proportion p-value ≤ 0.05);
  lucky runs on small suites no longer spawn proposals.
- **Model-switch discovery compares against the current model** — the cost/latency margin,
  the no-regression check on the other metric, and the pass-rate gate are all measured
  against the model the agent would actually switch away from (previously parts were
  measured against the runner-up, which could propose switches that regressed the agent).
- **Playground conversation uses the shared message bubbles** — turns in the agent
  playground now render with the same collapsible bubbles as the trace detail drawer
  (role accents, copy button, character count, raw/JSON/markdown views) while keeping
  edit-in-place, delete, and drag-to-reorder.
- **The downloadable install artifact now ships under a constant name** (`proxytrace.zip`)
  instead of a version-stamped filename, so install instructions and automation no longer
  need updating per release.

### Fixed

- **Theory backlog survives restarts** — theories still queued or validating when the
  server stops are re-queued on startup instead of being stranded (previously they also
  permanently consumed the per-project validation quota).
- **Upstream provider API keys are no longer returned to non-admin users** — the by-id
  provider endpoint (used by Tracey's tools) now redacts the upstream key; the setup
  connection-test and model-listing endpoints now require the Admin role.
- Faster evaluator-history queries on large test-result tables (new index).
- **Faster initial load** — the Tracey AI chat stack now loads in its own lazy chunk,
  halving the main JavaScript bundle (gzip 477 kB → 251 kB) and speeding up first paint
  on every page. Tracey's bundled manual-search index is also fetched on demand instead
  of shipping with her tools.
- The sidebar showed a hardcoded "v0.1 · alpha" label; it now shows the actual
  installed release version.
- **Settings → Danger zone:** "Delete all non-model data" left the dashboard and other
  views showing stale pre-wipe numbers until a manual refresh.
- Signing out now lands on a real `/login` URL instead of an undefined route.

### Security

- **Local-mode sessions now use an httpOnly cookie.** The session token is no longer
  persisted in browser `localStorage` (where any injected script could read it); the
  backend issues it as an `HttpOnly`/`SameSite=Strict` cookie and clears it on the new
  logout endpoint. API clients keep using the `Authorization` header unchanged.

## [1.0.0-rc.2] - 2026-06-12

### Added

- **License management in the UI** — a license key can now be activated without a restart:
  the setup wizard's Welcome step offers a *"Have a license key?"* field, and a new
  **Settings → License** page lets admins validate a key (dry run showing tier, customer,
  and expiry), activate it, force a license-server re-check, or remove it. A key activated
  in the UI is stored in the database and takes precedence over the `PROXYTRACE_LICENSE`
  environment variable.
- **Zero-configuration Docker install** — `docker compose up -d` now works without any
  `.env` file: the internal-only Postgres password defaults, the session signing key is
  generated on first start and persisted in a new `appdata` volume (sessions survive
  container recreation), and without a license Proxytrace runs the Free tier. All `.env`
  settings remain available as overrides.
- **Adoption tracking for promoted proposals** — a promoted proposal now waits in
  *"Promoted — awaiting adoption"* and flips to **Adopted** automatically when the exact
  change shows up in the agent's live traffic (new prompt/tool version, or calls arriving on
  the proposed model endpoint); auto-adoptions link the detected agent version ("Adopted in
  v{N}"). A **Mark adopted** button covers tweaked or undetectable adoptions.
- **Handoff package on promote** — copy buttons for the proposed prompt / tools JSON / model
  name, a downloadable markdown "apply this change" doc with the A/B evidence, and a
  machine-readable artifact endpoint (`GET /api/proposals/{id}/artifact`) for scripted
  workflows.
- **Generate JSON schema from an example** — the JSON Schema Match evaluator form can now
  infer a draft 2020-12 schema from a pasted example JSON value (every observed key becomes
  required; loosen by hand where needed).

### Changed

- **An invalid license no longer prevents startup** — a malformed/expired/rejected
  `PROXYTRACE_LICENSE` previously crashed the container; Proxytrace now boots with
  Free-tier entitlements, shows a red "license invalid" banner with the rejection reason,
  and the key can be fixed under Settings → License without a restart.
- **The license offline-grace cache is now persisted across container recreations**
  (in the new `appdata` volume), so the offline grace window is anchored correctly.
- **Promote is honest now** — Proxytrace is an observing proxy and cannot change your
  agent's code; the UI no longer claims a promoted change "has been applied to the agent".
  Proposal status changes are validated server-side (illegal transitions return 409).
- **Theory validation is now statistically gated** — an A/B pass-rate improvement only
  produces an optimization proposal when it is significant (two-proportion p-value ≤ 0.05);
  lucky runs on small suites no longer spawn proposals.
- **Model-switch discovery compares against the current model** — the cost/latency margin,
  the no-regression check on the other metric, and the pass-rate gate are all measured
  against the model the agent would actually switch away from (previously parts were
  measured against the runner-up, which could propose switches that regressed the agent).
- **Playground conversation uses the shared message bubbles** — turns in the agent
  playground now render with the same collapsible bubbles as the trace detail drawer
  (role accents, copy button, character count, raw/JSON/markdown views) while keeping
  edit-in-place, delete, and drag-to-reorder.

### Fixed

- **Theory backlog survives restarts** — theories still queued or validating when the
  server stops are re-queued on startup instead of being stranded (previously they also
  permanently consumed the per-project validation quota).
- **Upstream provider API keys are no longer returned to non-admin users** — the by-id
  provider endpoint (used by Tracey's tools) now redacts the upstream key; the setup
  connection-test and model-listing endpoints now require the Admin role.
- Faster evaluator-history queries on large test-result tables (new index).
- **Faster initial load** — the Tracey AI chat stack now loads in its own lazy chunk,
  halving the main JavaScript bundle (gzip 477 kB → 251 kB) and speeding up first paint
  on every page. Tracey's bundled manual-search index is also fetched on demand instead
  of shipping with her tools.

### Security

- **Local-mode sessions now use an httpOnly cookie.** The session token is no longer
  persisted in browser `localStorage` (where any injected script could read it); the
  backend issues it as an `HttpOnly`/`SameSite=Strict` cookie and clears it on the new
  logout endpoint. API clients keep using the `Authorization` header unchanged.

- The sidebar showed a hardcoded "v0.1 · alpha" label; it now shows the actual
  installed release version.
- **Settings → Danger zone:** "Delete all non-model data" left the dashboard and other
  views showing stale pre-wipe numbers until a manual refresh.
- Signing out now lands on a real `/login` URL instead of an undefined route.

## [1.0.0-rc.1] - 2026-06-11

### Added

- **Brand mark** — new "Scope" logo and app icons: a gold trace pulse over an
  oscilloscope graticule with a teal live cursor.
- **Trace capture** — OpenAI-compatible ingestion proxy that records every LLM
  interaction (requests, responses, tool calls, token usage, cost, latency) with
  zero agent code changes.
- **Projects, agents & API keys** — organize captured traffic per project and agent,
  authenticated with per-agent proxy API keys.
- **First-run setup wizard** — guided onboarding (provider → model → project) ending in
  per-language quick-start examples (Python, TypeScript, C#, curl); clients keep their
  upstream provider API key and swap only the base URL.
- **Dashboard & statistics** — live telemetry, token/cost breakdowns, latency and
  pass-rate trends per agent, model, and project.
- **Test suites & evaluators** — curate captured traces into benchmark suites and
  judge them with configurable evaluators (including agentic and custom evaluators).
- **Test runs** — execute suites against any model endpoint with a live, streaming
  results view and per-evaluator progress.
- **Optimization loop** — data-driven optimization theories, A/B validation runs,
  and reviewable improvement proposals.
- **Tracey** — built-in AI assistant with access to your traces and the manual.
- **Authentication** — local accounts or OIDC single sign-on (Enterprise).
- **Licensing** — Free tier built in; Enterprise features unlocked with a license key.
- **Self-hosted deployment** — versioned container images on GHCR with a downloadable
  Docker Compose artifact; database migrations apply automatically on upgrade.
- **Update notifications** — daily check against the public release feed; admins see a
  dismissible in-app notice when a newer version is available (opt-out via `Updates:Enabled`).
- **User & operator manual** — bundled at `/docs`, searchable, with admin guides.
