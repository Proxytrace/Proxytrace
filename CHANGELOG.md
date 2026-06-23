# Changelog

All notable, user-facing changes to Proxytrace are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions
follow [Semantic Versioning](https://semver.org). Ongoing work is collected under
`[Unreleased]`; cutting a release moves that section under the new version heading
(see `docs/releasing.md`).

## [Unreleased]

### Added

- **Secrets are now protected at rest.** Upstream provider API keys are encrypted in the database
  (recovered only to call the provider), while inbound Proxytrace API keys and invite tokens are
  stored as one-way hashes. As a result, a newly generated API key and a new invite link are now
  shown **once, at creation** — copy them then; afterwards the key list shows only a short,
  non-secret prefix to identify each key. Existing keys, provider credentials, and pending invites
  are protected automatically on upgrade, with no action required and no disruption to live
  integrations.

- **Email notifications.** Operators can configure outgoing SMTP under **Settings → Email notifications** and users can opt in to receive notification alerts by email, choosing **All**, **Critical**, or **None** from the account menu (defaulting to All). The SMTP password is encrypted at rest using ASP.NET Data Protection.

- **Audit log of system actions.** Proxytrace now keeps a durable, user-attributed record of
  significant actions — authentication events (sign-in, failed sign-in, sign-out, first-admin setup,
  legacy-account claim), user invites/sign-ups/role changes/deletions, project create/rename/delete
  and membership changes, agent endpoint changes and deletions, test-suite / test-case / evaluator
  creation, update and deletion, test runs started (manual, scheduled, or via MCP), optimization
  proposal status changes, API keys minted and deleted, provider/endpoint configuration changes, and
  license changes. Each entry captures **who** performed it (the signed-in user, the owner of the API
  key used, or the system for scheduled work), **what** was acted on, and **when** — and entries are
  kept even after the thing they refer to is deleted. Admins see the full trail under
  **Settings → Audit log**; project members see their own project's trail (but not instance-wide
  actions). The log is lossless and retained for 365 days by default.

- **Cached-input tokens are now tracked and priced separately.** Many providers serve part of a
  prompt from their cache at a much lower rate. Proxytrace now captures how many of each call's input
  tokens were cache-served (from both the ingestion proxy and Playground/test-run/evaluator calls),
  fetches the cheaper **cached-input price** from the model-price catalog alongside the input/output
  prices, and factors it into every cost estimate — so the numbers reflect what you actually pay. A
  muted **"(N% cached)"** hint now appears next to the input-token figures across Traces, the
  dashboard, the Playground, agent and run summaries, and the LLM-judge cost panels. Calls with no
  cached price keep costing exactly as before.

- **Connect external AI agents over MCP.** Proxytrace now hosts a built-in
  [Model Context Protocol](https://modelcontextprotocol.io) server at `/mcp`, so external agents
  (Claude Desktop, Cursor, your own scripts) can use Proxytrace the way the built-in Tracey assistant
  does — listing and reading agents, traces, suites, runs, proposals and statistics, curating suites
  from captured traces, starting test runs, analysing run failures, and submitting A/B-tested
  optimization theories. It also ships **guided workflows** (MCP prompts an agent surfaces as slash
  commands — `optimize_agent`, `curate_suite`, `run_tests`, `review_proposals`, `project_insights`)
  that walk an external agent through the same playbooks the built-in Tracey assistant uses. It
  authenticates with a Proxytrace **API key** (minted
  on the Providers page): the key's project becomes the agent's working context. API keys now carry
  explicit **capabilities** — *Ingestion proxy*, *MCP read*, *MCP write* — chosen when the key is
  created, so an agent key can be made read-only and a proxy key can't drive MCP (least privilege).
  Each key also has an **owner** (a user, chosen at creation): every MCP call is attributed to that
  user. See the **MCP Server** guide for client setup and the full tool list.

- **Multilingual UI with per-user language.** Proxytrace can now display its interface in multiple
  languages, starting with **German** alongside English. Each user picks their own language from a
  grouped **Language** section in the account menu (top-right) — each option shown with its country
  flag — and the choice is saved to their account so it follows them across devices and browsers. Technical terms that AI engineers expect in English — Tool, User, Assistant,
  Trace, Token, Prompt, Agent, and the like — are deliberately kept untranslated. English remains the
  source language, and new translations are produced by an audience-aware translation tool, so more
  languages can be added without code changes.

- **Stop Tracey mid-reply.** While Tracey is thinking or replying, her **send** button now becomes a
  **Stop** button — pressing it cancels the response. The in-flight model call is torn down (not left
  running in the background), so a long or off-track answer can be halted immediately. If she was
  waiting on a long-running action you started (a test run or optimization theory), stopping only ends
  her wait — that action keeps running on the server and its result still lands on the Runs/Proposals
  page.

- **Jump from an error toast to the captured error.** When a backend request fails, the red error
  toast is now clickable for admins — selecting it opens the **Error Log** with that exact error
  already selected, so you go straight from "something broke" to its full stacktrace. The toast
  carries the captured error's id; non-admins (who can't see the Error Log) get the plain,
  non-clickable toast as before.

- **Notifications inbox in the top bar.** A new bell icon in the top bar — with an unread badge —
  opens a notifications inbox available on every page. It surfaces negative anomalies detected after
  each test run — a run that **failed** (e.g. the endpoint was unavailable), a **drastic pass-rate
  drop**, or a **strong latency increase** versus the suite's recent baseline. Alerts arrive live (no
  refresh), are colour-coded by severity, deep-link to the affected run, and can be marked read or
  dismissed; an unread count shows at a glance. The inbox is multi-purpose by design: the same surface
  will carry other notification kinds (such as a ready optimization proposal) and, in a future
  release, additional delivery channels like email.

- **A suite's run history at a glance.** The suite detail panel has a new **History** tab listing
  that suite's previous runs (newest first, with per-model pass rates); clicking a run opens it on
  the Runs page. The history is fetched suite-scoped, so it isn't diluted by other suites on the same
  agent. The header's run button is now simply labelled **Run**.

- **Periodic test-run scheduling (Enterprise).** Test suites can now be run automatically on a
  recurring schedule against a fixed set of model endpoints. Pick a frequency — **hourly** at a
  chosen minute, **daily** or **weekly** at a chosen time of day (UTC), or a **custom** every-N
  minutes/hours/days interval — and the dialog **previews the exact next execution date/time** as
  you choose. Schedules are managed from the new **Scheduled** tab on the Runs page — create, edit,
  pause/resume, and run-now — and each schedule card shows its cadence, the next run's date/time, and
  a summary of its most recent runs. Scheduled runs feed the optimization loop exactly like manual
  ones. Creating and managing schedules requires an Enterprise license; existing schedules stay
  listable after a downgrade but stop running until re-licensed. You can also create and manage a
  suite's schedules directly from its detail panel on the Suites page.

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

- **Tracey shows cards on demand instead of one per tool call.** A multi-step answer used to stack
  a full card for every lookup Tracey did on the way to the result. Now Tracey decides what's worth
  showing: the reads she does for her own reasoning collapse to a quiet, expandable one-line trace,
  and a full card appears only when that card *is* the answer you asked to see. Charts, tables, the
  entity you asked about, live test-run/optimization cards, and confirmations still render in full —
  the change only quiets the intermediate lookups, so the thread reads cleaner.

- **A suite now runs against at most three model endpoints at once.** Both manual runs and
  scheduled runs are capped at three endpoints per run, so a model comparison stays focused (and
  bounded in cost). Endpoints are now picked from a **searchable multi-select** (replacing the old
  stacked checkbox list, which scaled poorly with many models) — type to filter, selected models
  show as chips, and the picker disables further options once three are selected. The API rejects
  any attempt to exceed the limit.

- **One consistent left-hand list across the workspace.** Agents, Evaluators, Test Suites, Test
  Runs, and the Evaluator Playground now share a single left-column design — the same framed panel,
  the same header layout (title, count, create, search, filters), the same column width, and the
  same selected-row highlight everywhere. Previously each page styled its list differently; the
  views now feel like one product.

- **The Test Suites workspace is easier to scan and edit.** The performance strip is now a compact
  single-line KPI row (no boxed dividers, roughly half the height). In the **Test Cases** tab, the
  old Current / Add-from-traces tab chips are gone — current cases are always shown, and a single
  **Add from traces** button opens a full picker (search, time-range filter, live conversation
  preview); chosen traces stage inline as **Pending add** rows until you Save. In the **Evaluators**
  tab, each evaluator now attaches/detaches with a slide **toggle** instead of a checkbox. The suite
  list cards are more compact, mirroring the Agents list (avatar, agent subline, cases · pass rate ·
  last run).

- **The Test Suites page is now a master–detail view.** Instead of a grid of cards that each
  opened an edit modal, the page is a suite list on the left and a single workspace panel on the
  right. The panel leads with the suite header (run / delete) and a performance strip —
  bucket-selectable run statistics over a time window (Last run / last 7 days / last 30 days / all
  time — pass rate, run count, average run duration, total cost) — then a tabbed editor for the
  suite's **Test Cases**, **Evaluators**, and **Schedules** (add, remove, edit, attach/detach, and
  schedule inline). Staged edits collect in a sticky **Save changes** bar at the foot of the panel.
  Creating a new suite still uses the step wizard.

- **The dashboard and traces views stay fast with very large trace volumes.** Trace statistics
  (token usage, latency percentiles, call trends, per-agent rollups, live telemetry) now aggregate
  inside the database instead of loading every matching call into memory, and the traces table
  reads a lightweight row projection instead of the full request/response payload of each call.
- **Trace ingestion keeps up under high proxy load.** The ingestion worker now persists captured
  calls in parallel (tunable via `Messaging:MaxConcurrency`, Redis deployments only) and reads the
  stream in larger batches. The dashboard's **Queue depth** now reflects the real ingestion backlog,
  so a consumer falling behind is visible before unprocessed traces are dropped.
- **Live streams and the optimization views use less CPU and memory under load.** Real-time SSE
  event payloads are now serialized once and shared across all connected clients instead of being
  re-serialized per open stream, the proxy and Tracey token relays no longer allocate a throwaway
  buffer per streamed line, and the evaluator test-history queries read a lightweight row projection
  instead of every full result (including its stored response payload).
- **Test-run live updates scale with many concurrent runs.** The test-result event broadcaster now
  routes each event directly to the subscribers of that run/group instead of scanning every live
  subscriber on the instance, so a busy multi-run period no longer does work proportional to the
  total number of open streams per event.

### Removed

- **Error-report dialog removed from the error toast.** The "Send" action on error toasts and its
  report dialog have been retired — they posted a one-off server log line and nothing more. Errors
  are still surfaced as toasts and logged server-side; a proper error-reporting flow will be built
  from scratch in a future release.

### Security

- **Systemic cross-tenant access (IDOR) across the CRUD and SSE APIs is now closed.** The app is
  multi-tenant (resources belong to a project; users belong to projects; admins bypass), but the bulk
  controllers never checked membership: any authenticated user could read, modify, delete, or trigger
  billable runs on **another tenant's** traces, agents, agent versions, proposals, theories, test
  suites/cases/runs/run-groups/schedules, evaluators, notifications, and search — and the real-time
  streams broadcast every tenant's events to everyone. A central `IProjectAccessGuard` (admin bypass)
  now backs every one of these endpoints: a single resource you can't access returns `404` (so its
  existence doesn't leak); list endpoints are scoped to your member projects instead of returning all
  tenants' rows; per-resource streams are membership-checked before subscribing; and the global trace
  and notification streams filter each event to your projects.

- **Projects and their members are no longer enumerable across tenants.** `GET /api/projects`,
  `GET /api/projects/{id}`, and `GET /api/projects/{id}/members` had no membership filter, so any
  authenticated user could list every project, read any project's details, and harvest any project's
  members' emails. Non-admins are now scoped to the projects they belong to (admins still see all),
  and out-of-scope projects return `404` so their existence does not leak. Membership can also no
  longer be mass-assigned through the generic project update: `memberIds` was dropped from the update
  request, so the member set changes only via the dedicated add/remove-member endpoints.

- **The user roster is no longer exposed to non-admins.** `GET /api/users` (every user's email,
  role and timestamps), `GET /api/users/{id}`, and `GET /api/users/{id}/projects` were callable by
  any authenticated user, leaking the full user base and their PII. They now require the Admin role,
  matching the existing role-change and delete endpoints; the self-service `me` endpoints stay open.
- **Test-support and `/seed` endpoints are no longer reachable on real deployments.** The e2e helper
  endpoints (including a destructive `POST /api/test/reset` that wiped all run data, and the
  per-controller `/seed` injectors) were exposed to any authenticated user in production. They are
  now gated behind a `TestOnlyEndpoint` guard (Development env or `TestSupport:Enabled`), so a
  normal user can no longer wipe or fabricate data.
- **Proxy API keys are now generated with a cryptographic RNG** instead of a GUID, and the
  long-lived session token is accepted in the `?access_token` URL only on SSE (`…/stream`) routes
  rather than on every request — closing a token-in-URL leakage path. Client error reporting
  (`POST /api/errors`) now requires authentication.
- **Upstream provider API keys are no longer rendered in diagnostics.** `ModelProvider` is a record
  whose compiler-generated `ToString()` printed every property, so a configured upstream credential
  could surface in a log line, exception message, or debugger string. The key is now redacted from the
  record's string representation.

### Fixed

- **Model-call clients no longer leak their HTTP transport, and the tool-schema parser no longer
  leaks pooled buffers.** Every LLM call (test runs, the Playground, agentic evaluators, and the
  prompt/tool optimizers) built a fresh client wrapping a disposable provider transport that was
  never disposed — so across a run's cases × evaluators × baseline/candidate A/B calls each one
  abandoned its transport state. The per-request tool-definition builder also parsed each tool's
  JSON schema with a `JsonDocument` that was never disposed, defeating its pooled-buffer reuse on
  every tool of every request. The model client is now disposable and every caller releases it
  immediately after use, and the schema parse is scoped so its buffer is returned right away.

- **Test run groups no longer leak `CancellationTokenSource` instances.** Every foreground,
  background, and A/B validation run group created an owned `CancellationTokenSource` plus a linked
  source (to combine the caller's token with run cancellation), but the `finally` only removed the
  owned source from the runner's registry — neither was disposed, and the linked source's reference
  was discarded entirely so it could never be disposed. The optimization loop fires baseline + candidate
  runs per theory, so both sources (and the callback the linked source registers on the caller's token)
  accumulated steadily in a long-running process. Both are now disposed in the `finally` (the linked
  source before the owned one).

- **Deleting a model provider or endpoint can no longer wipe your traces.** The trace history
  (`AgentCall`) and the endpoint→provider link were configured to *cascade* on delete, so a single
  hard delete of a provider could have removed every endpoint under it and, with them, every trace
  recorded against those endpoints — irreversible telemetry loss. Both foreign keys are now
  `Restrict`: providers and endpoints are still removed the safe way (they are archived, which keeps
  their history), but a stray hard delete or manual database statement can no longer cascade through
  to the traces table.

- **A burst of unparseable ingestion entries during a Redis outage no longer stalls the consumer.**
  The Redis ingestion consumer acknowledged "poison" entries (captured calls that fail to
  deserialize) with a blocking, synchronous `XACK` from inside its read loop. Because the Redis
  client is configured to fail slowly rather than on connect, each such ack could block for the full
  connect timeout (~5s) while Redis was unreachable — so a burst of poison entries during a Redis
  blip serialized those waits and wedged ingestion, and a thrown ack tore down the whole parallel
  processing round. Poison entries are now acknowledged with a single batched **asynchronous** ack
  per read, off the hot yield path and guarded so a transient Redis error just leaves them to be
  reclaimed and retried.

- **Retryable ingestion failures no longer leak memory or silently drop traces in single-process
  deployments.** The ingestion worker tracked retryable failures in a dictionary and left the
  message unacknowledged for the transport to redeliver. That is correct for Redis Streams, but the
  in-process channel used by single-process/kiosk runs never redelivers — so each retryable failure
  left an orphaned entry that grew unbounded under sustained failures, and the "retryable" message
  was lost rather than reprocessed. The worker now detects whether the transport actually redelivers:
  on the in-process channel it retries inline (a bounded number of times, then drops) and keeps no
  per-message state, while the Redis path is unchanged.

- **A large upstream response can no longer exhaust proxy memory on non-streaming calls.** The
  proxy's buffered (non-streaming) path read the entire upstream body into a string and then
  re-encoded it to bytes, leaving several full-size copies resident per in-flight request with no
  size cap on the response side — a very large or hostile upstream reply could push the ingestion
  proxy to OOM. The buffered path now streams the body straight through to the client in chunks
  (forwarded byte-for-byte, never truncated) and bounds only the copy it captures for ingestion to
  the same 16 MiB ceiling the streaming path already applied.

- **A hung model provider no longer stalls test and optimization runs indefinitely.** Internal model
  calls (optimizers, evaluators, the playground) were made with no request timeout and no retry
  policy, so a wedged or very slow upstream had no upper time bound and could pin a worker forever,
  stalling the serial A/B-validation / optimization queue. Each call now has a hard network-timeout
  ceiling independent of the caller, plus a bounded retry policy for transient failures.

- **Proxied calls are no longer dropped when the client disconnects after the upstream responds.**
  The proxy threaded the client request-aborted token all the way into the ingestion publish, so a
  client cancel/timeout/navigation *after* the upstream LLM call had already completed (a common
  pattern) cancelled the publish and silently lost the captured call. Capture is now decoupled from
  the client request lifetime — the publish runs with an independent token, and the streaming path
  publishes the accumulated transcript even on a mid-stream disconnect.

- **A malformed `Content-Type` header no longer crashes a proxied request.** The OpenAI-compatible
  ingestion proxy parsed the client-supplied `Content-Type` strictly, so a single bad value (e.g.
  `garbage;;`) threw and surfaced as an opaque `500`. The header is now parsed leniently and, when it
  cannot be parsed, forwarded upstream unchanged — the request proceeds normally instead of failing.

- **Captured calls with a non-UUID session id are no longer silently dropped.** When a client sent a
  session identifier that was not a GUID, Proxytrace hashed it to derive a stable conversation id but
  built the id from all 20 SHA-1 bytes, which threw and caused every such call to be discarded during
  ingestion. The hash is now truncated to 16 bytes, so calls carrying arbitrary session ids are
  captured and grouped into the same conversation as expected.

- **Saving a record no longer spuriously fails on the in-memory database.** After `UpdatedAt` became
  a database concurrency token, ordinary single-actor updates (for example a user changing their
  email-notification preference) could fail with a false "modified by another process" error on the
  in-memory storage backend used by the all-in-one/kiosk runtime, because the version stamp was being
  truncated to the precision PostgreSQL stores even when running in memory. The truncation now only
  applies on PostgreSQL, so updates succeed normally on both backends.

- **Concurrent edits to the same record no longer silently overwrite each other.** Optimistic
  concurrency was only checked in application code before a save, so two edits that started from the
  same version of a record could both pass the check and both write — the second silently discarding
  the first. The version stamp (`UpdatedAt`) is now enforced as a database concurrency token, so a
  genuine race is caught at write time and the losing edit fails cleanly instead of clobbering data.

- **The Playground agent picker only lists real agents.** The agent select-box no longer offers
  internal system agents (such as the built-in Tracey agent) — it shows only the user-facing agents
  you can actually run in the Playground.

- **Test suites can be deleted again.** Deleting a suite that had been run (or that had an
  optimization theory) failed with a foreign-key error: the run groups, runs, A/B-test proposals and
  theories that referenced it blocked the delete. Removing a suite now cascades to all of them — its
  run groups, runs, schedules, theories, and the proposals produced from those runs are removed with
  it — so a suite you no longer want always deletes cleanly.

- **Tracey reliably optimizes an agent you name.** Asked to "optimize the X agent", Tracey used to
  trip twice: she passed the typed agent *name* where an agent *id* was required (a guaranteed
  "not found"), and then listed *every* suite in the project with no way to tell which belonged to
  the agent (the suite index carried only id and name, not the agent). Now she resolves the name to
  an id first, and listing suites takes an optional agent filter with each row carrying its agent —
  so she finds the right agent and the right suite to validate the optimization against instead of
  guessing. Tracey can also now narrow **runs** and **proposals** to a single agent (previously only
  traces and theories could be filtered), so she pulls just that agent's evidence instead of the
  whole project's. If a name still slips into an id filter (suites, runs, proposals, or theories), it
  now degrades to a clean "not found" the assistant can recover from instead of a raw `400 Bad
  Request` error toast.
- **Tracey no longer goes silent after a page reload.** The in-app assistant kept the app's JWT in
  memory only, but its chat transport sent a placeholder `Authorization` header when that token was
  absent — which is the case after every browser reload (the session is restored from the cookie, not
  the token). The backend rejected the bogus bearer with a 401 instead of falling back to the valid
  session cookie, so every message sent after a reload produced no response. The transport now drops
  the placeholder header when there is no token, letting the same-origin session cookie authenticate
  the call exactly like every other request.
- **The dashboard no longer hangs for ~5 seconds when Redis is unreachable.** The dashboard reads the
  ingestion queue depth on every load; with the Redis transport configured but Redis down, that read
  blocked on the connection timeout (~5s) before quietly giving up, making the whole dashboard crawl
  on every refresh even though no other page was affected. The queue-depth read now bails out
  immediately when the connection is unavailable, so a Redis outage degrades only the depth figure
  (shown as 0) instead of stalling the page.
- **Test-run statistics no longer fail to project on a startup insert race.** When the statistics
  backfill (run at startup) and the live projector both computed stats for the same just-finished
  run, one lost the insert race and the recovery retry — sharing the same transactional context —
  replayed the orphaned insert, hitting the unique `TestRunId` constraint again and logging a
  `duplicate key value violates unique constraint "IX_TestRunStatsEntity_TestRunId"` error while
  leaving that run's stats unprojected. The failed insert is now discarded before the retry, so it
  correctly falls back to an update.
- **Setup no longer fails when a provider lists a zero-cost model.** Initial setup refreshes a
  provider's model catalog and prices; a discovered model whose price was non-positive (e.g. a free
  model listed at `0`) or inverted violated the model-endpoint price invariants and aborted the whole
  setup with a 500. Such models are now skipped (logged) and the remaining priced models import
  normally.
- **The dashboard loads much faster in kiosk/demo mode.** The dashboard's statistics aggregation
  fans ~11 independent queries out concurrently, but the in-memory store used by kiosk mode runs
  queries synchronously, which silently collapsed that fan-out into sequential execution — making
  the dashboard (the landing page) take ~0.5s warm / ~2s cold while every other page stayed
  instant. The queries now run concurrently again, cutting the dashboard load to roughly a single
  query's time.
- **The proxy no longer leaks database connections while resolving API keys.** The cached API-key
  resolver was a singleton holding repositories bound to the root scope, so the short-lived database
  context created on each cache-miss lookup was never disposed until shutdown. The resolver is now
  per-request (the cache it shares stays process-wide), so those contexts are released promptly.
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
- **An unevaluated test result is no longer counted as a pass.** A test result's `Passed` flag used a
  vacuous "all evaluations passed" check that was true when there were *no* evaluations, disagreeing
  with the canonical pass rule used by the optimization loop; both now agree — a result passes only
  with at least one evaluation, all passing.
- **The exact-match evaluator now fails when the response has a different number of content parts.**
  It compared parts pairwise with `Zip`, which silently truncated to the shorter sequence, so a
  partial or padded response could score as an acceptable match. A differing part count is now a
  mismatch.
- **A cancelled or failed test run can no longer be revived by a late result.** A result arriving
  in-flight after a run reached a terminal state transitioned it back to running/completed and
  overwrote its completion time; such late results are now ignored.
- **Valid configurations are no longer rejected by domain validation.** A numeric-match evaluator with
  a tolerance of `0` (exact numeric match) and prompt-template variables with a single letter (e.g.
  `{{x}}`) were incorrectly rejected; both are now accepted, while a purely numeric variable name (no
  letters) is still rejected.
- **Domain hardening.** Invalid tool JSON schemas are now surfaced as validation errors instead of
  throwing out of validation; referenced entities/values (A/B run, proposed tools, evaluator project,
  schedule endpoints) are validated consistently; entity identity and value-object hashing were
  corrected (identity by id; collection-backed value objects now hash by content); an agentic
  evaluator no longer records run cancellation as an evaluation error; and token-usage subtraction is
  clamped at zero so it can never underflow.

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
