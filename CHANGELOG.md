# Changelog

All notable, user-facing changes to Proxytrace are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions
follow [Semantic Versioning](https://semver.org). Ongoing work is collected under
`[Unreleased]`; cutting a release moves that section under the new version heading
(see `docs/releasing.md`).

## [Unreleased]

### Changed

- **Theory validation is now statistically gated** — an A/B pass-rate improvement only
  produces an optimization proposal when it is significant (two-proportion p-value ≤ 0.05);
  lucky runs on small suites no longer spawn proposals.
- **Model-switch discovery compares against the current model** — the cost/latency margin,
  the no-regression check on the other metric, and the pass-rate gate are all measured
  against the model the agent would actually switch away from (previously parts were
  measured against the runner-up, which could propose switches that regressed the agent).

### Fixed

- **Theory backlog survives restarts** — theories still queued or validating when the
  server stops are re-queued on startup instead of being stranded (previously they also
  permanently consumed the per-project validation quota).
- **Upstream provider API keys are no longer returned to non-admin users** — the by-id
  provider endpoint (used by Tracey's tools) now redacts the upstream key; the setup
  connection-test and model-listing endpoints now require the Admin role.
- Faster evaluator-history queries on large test-result tables (new index).

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
