# Proxytrace — Feature Ideas & Next Steps (July 2026)

A grounded brainstorm of candidate features, written against the current architecture
(1.3.0 + unreleased). Each idea names the existing seam it would build on and a rough size.

**Operating constraints honored throughout** (per prior product decisions):

- Proxytrace is an *observing* proxy. It cannot dictate which tools the client offers —
  tool definitions live at the client. It **can** override the system prompt and tool
  *descriptions* in flight.
- Ruled out: hosting full agent definitions in Proxytrace; "closing the loop" by
  auto-applying proposals as the source of truth.

Ideas are grouped into four themes. A shortlist with a recommended order is at the end.

---

## Theme A — Exploit the proxy position

The proxy sits on the live request path. Today it only *observes*. Everything below uses
that unique position without taking ownership of the agent definition.

### A1. Live canary for accepted proposals (prompt-override rollout) ⭐

**What.** After a proposal is Accepted, optionally let the proxy apply the proposed
system-prompt (or tool-description) override to a configurable slice of live traffic
(e.g. 10%), with an instant kill switch. Compare canary vs. baseline on live metrics
(pass proxies: outlier rate, tool-call failures, latency, cost) and report the delta on
the proposal page.

**Why.** Today validation happens only on the curated suite (A/B run), then the proposal
crosses a trust gap to production via copy-paste. A canary graduates a proposal from
"won on the benchmark" to "confirmed on real traffic" *before* the developer edits code —
without violating the constraint: we only override what we can already override, the
client keeps owning the definition, and the canary is temporary by design (it ends when
the developer adopts the change or the user stops it).

**How it lands.** New proxy pipeline stage keyed by agent attribution (the
`X-Proxytrace-Agent` header path already exists); canary state on `OptimizationProposal`
(new status facet, not a new entity); traces tag which arm served the call (a flag next to
`OutlierFlags`); adoption tracking (Stage 5) already watches for the real change and would
end the canary naturally. Licensing: fits the existing `OptimizationProposals` gate.

**Size.** L. The highest-leverage item in this list: it turns the proxy from a passive
recorder into the product's moat, and it strengthens the existing loop instead of adding a
side feature.

### A2. Guardrails / policy layer at the proxy

**What.** Per-agent policies evaluated on the live path: PII/secret redaction (toward the
provider, at-rest, or both), prompt-injection screening of tool results, response content
rules. Two enforcement modes: *annotate* (flag the trace, notify) and *block* (synthesize
an error response).

**Why.** Teams routing production traffic through Proxytrace have already accepted a
man-in-the-middle; policy enforcement is the natural second duty. It is also a
differentiator vs. pure observability tools, and enterprise-friendly (pairs with the
existing audit log).

**How it lands.** Mirror the outlier-detection pattern: a `PolicyFlags` bitmask on
`AgentCall`, a detector invoked from `AgentCallProcessor` (annotate mode), plus a proxy
middleware for block/redact mode. Admin settings page like **Settings → Outlier
detection**. Notifications reuse `INotificationService`.

**Size.** M–L (annotate-only MVP is M; blocking + redaction rules is the L half).

### A3. Budgets and hard limits

**What.** Spend budgets per project / agent / API key with thresholds: notify at 80%,
hard-fail (429 with a clear error body) at 100%, monthly reset. Optional per-key rate
limits.

**Why.** Cost is already tracked per call (`ModelEndpoint.CalculateCost`), but nothing
*enforces* anything — the first runaway-agent incident a customer has is the moment this
feature sells itself. Small, obvious, high-trust.

**How it lands.** New small domain entity (`Budget`), a cheap aggregate check in the proxy
path (cached, eventually-consistent is fine), notifications via the existing channels,
admin UI. Perf note: the check must not scan traces per call — maintain a running
counter (the statistics projections already aggregate cost).

**Size.** M.

### A4. Provider failover and resilience routing

**What.** Per-agent fallback policy: on provider outage / 5xx / timeout, retry with
backoff and optionally fail over to a designated alternate `ModelEndpoint`. The trace
records the reroute so failovers are visible and analyzable.

**Why.** Anomaly detection already *notices* "endpoint unavailable" — this acts on it.
For platform teams, "put Proxytrace in front and your agents survive provider incidents"
is a compelling reason to adopt the proxy even before they care about evals.

**How it lands.** Proxy-side policy + `ModelEndpoint` fallback reference; a flag on the
trace; a dashboard slice ("calls served by fallback"). Careful scoping: same wire format
(OpenAI-compatible upstreams) first.

**Size.** M.

### A5. Native Anthropic / Gemini wire formats on the ingestion proxy

**What.** Accept the Anthropic Messages API (`/anthropic/v1/messages`) and Gemini's
native API on the proxy, normalizing into the same `AgentCall` model. Today only the
OpenAI-compatible shape is ingested.

**Why.** The funnel is capped by "your client must speak OpenAI-compatible". Many agent
stacks (Claude Code, Anthropic SDK users, Vertex users) don't. Normalization is the
product's job, not the customer's.

**How it lands.** New controllers in `Proxytrace.Proxy` + translation into the
`Conversation`/`ToolSpecification` domain shapes (which are already provider-neutral).
Streaming pass-through parity required.

**Size.** L (streaming + tool-call mapping edge cases dominate).

---

## Theme B — Deepen the evaluation moat

### B1. Multi-turn test cases: simulated user + tool playback ⭐

**What.** Today a `TestCase` is one input `Conversation` → one expected
`AssistantMessage` — a single step. Add a second case type: a *scenario* with a goal and
a simulated user (LLM-driven, seeded from the source trace), plus tool-response stubs so
the agent loop can actually run for several turns. Stubs come recorded from the original
trace (exact playback) or LLM-mocked (flexible playback). Evaluators then score the whole
episode (goal reached, tool usage, turn count, cost).

**Why.** Agents fail across turns — tool loops, forgetting, derailing — and a single-step
benchmark cannot pin those behaviors. This is the biggest gap between "we test agents"
(the pitch) and what a run exercises today. Tool playback respects the core constraint:
we never execute the client's real tools, we replay/simulate their results.

**How it lands.** New case type beside `ITestCase`; `TestRunnerService` gains an episode
loop; recorded stubs are extracted from the source `AgentCall` conversation (tool
request/response pairs are already captured in full fidelity); new evaluator inputs
(episode-level `IEvaluation`). Sampling (1–5) already exists and matters even more here.

**Size.** L. Flagship-grade.

### B2. Suite coverage drift detection

**What.** Embed production traces and suite cases; continuously measure whether the
suite still *covers* what production actually looks like. When traffic drifts (new topic
clusters with no nearby test case), raise a notification and suggest representative
traces to promote.

**Why.** Every eval product suffers benchmark rot; almost none detect it. This turns
"curate your suite" from a one-time chore into a maintained loop, and it generates the
suggestions itself. Strong differentiator, honest about a real failure mode of the
product's own methodology.

**How it lands.** Embeddings via the project's `SystemEndpoint` (system agents already
exist for name generation / optimizers); a background job computing cluster coverage;
notification + a "suggested cases" inbox on the suite page (see B3). Store vectors in
Postgres (pgvector) — a database.md decision.

**Size.** L.

### B3. Suggested-test-case inbox (mine failures into cases)

**What.** A per-suite "Suggestions" queue auto-populated from: outlier-flagged calls,
anomaly windows, failed/low-scoring evaluations, and end-user feedback (B4). One click
promotes to a case (the promote-trace-to-case flow already exists).

**Why.** The pipeline from "something went wrong in prod" to "it is now a pinned
regression test" is the product's core story — today the discovery half is manual
browsing. Cheap to build, immediately felt in daily use.

**How it lands.** A scoring/queue service over existing signals (`OutlierFlags`,
evaluations, notifications), plus UI on the suite detail. No new heavy infrastructure.

**Size.** M.

### B4. End-user feedback ingestion

**What.** Let the customer's app attach feedback to a trace or conversation:
`POST /api/traces/{id}/feedback` (or an ingestion header for correlation) with
👍/👎, rating, free-text correction. Surface it on traces, as a dashboard metric, as a
filter, and as a first-class signal into B3's suggestion queue.

**Why.** Real user dissatisfaction is the highest-value eval signal there is, and today
it has no way into the system. Also the cheapest bridge between product analytics and
the optimization loop: theories can cite "12 thumbs-down traces" as motivation.

**How it lands.** Small `TraceFeedback` entity keyed to `AgentCall`/`ConversationId`;
API-key-authenticated endpoint (new `ApiKeyScopes` flag, mirroring the MCP scopes
pattern); trace list column + filter, agent-page stat.

**Size.** M.

### B5. Evaluator calibration (trust the judge)

**What.** A human-grading queue: sample N results per week, a reviewer grades them
blind, and Proxytrace reports agreement between each agentic (LLM) evaluator and the
human labels over time — flagging judges that drift or systematically disagree.

**Why.** The whole optimization loop leans on evaluator scores (A/B significance testing
included). "How much can I trust the judge?" is the first question a sophisticated
customer asks, and today there is no answer in-product.

**How it lands.** Small grading UI + a `HumanGrade` record per sampled `TestResult`;
an agreement report on the evaluator detail page. License-gates naturally next to
`AgenticEvaluators`.

**Size.** M.

---

## Theme C — Production-monitoring maturity

### C1. Live-traffic monitors and SLOs

**What.** Anomaly detection currently runs on *test runs* only. Add aggregate monitors
over ingested traffic: outlier-rate spike, upstream error rate, latency p95, cost per
hour — plus user-defined SLO targets per agent ("p95 < 3s", "pass proxy ≥ …") with
error budgets and burn-rate alerts.

**Why.** The per-call outlier flag (1.3.0) finds the needle; nothing watches the
haystack. Between releases of the agent, live monitors are what keeps a team opening
Proxytrace daily.

**How it lands.** A `BackgroundService` in the mold of `AnomalyDetectionService`,
consuming the existing statistics projections; alerts through `INotificationService`.
SLO definitions are a small per-agent entity + settings UI. Perf: evaluate against
projections, never raw trace scans (perf suite budget required).

**Size.** M.

### C2. Webhook + Slack notification channels

**What.** Two new `INotificationChannel` implementations: a generic signed webhook
(JSON POST, HMAC header) and Slack (incoming webhook URL). Per-project routing config.

**Why.** The seam was explicitly designed for this ("Adding a new channel (webhook,
Slack, etc.) requires only a new `INotificationChannel` registration"). Alerts that only
live on a dashboard nobody has open are alerts that don't exist. Cheapest
credibility-per-line-of-code in this document.

**How it lands.** Exactly as `docs/notifications.md` prescribes; settings UI next to the
email channel config; secrets encrypted at rest like SMTP credentials (security.md
seams).

**Size.** S.

### C3. Version impact reports

**What.** Auto-annotate the agent's version timeline with observed before/after deltas:
"v12 (adopted Jun 21): pass proxy +4.8pp, cost/conv −12%, p95 −300ms, outlier rate
−1.1pp". Attach the same delta card to Adopted proposals — closing the narrative:
*this proposal, once adopted, actually delivered X*.

**Why.** Adoption tracking (Stage 5) already detects *that* a change landed but never
answers *whether it helped live*. This is the product's ROI receipt — the screenshot a
champion pastes into the team channel to justify the subscription.

**How it lands.** A read-time comparison over existing per-agent statistics windows
keyed by `AgentVersion` boundaries + the proposal's `AdoptedAgentVersionId`. Mostly
query + UI work; perf-test the window queries.

**Size.** M.

### C4. Scheduled digest ("agent health weekly")

**What.** A weekly (configurable) per-project email/webhook digest: trend sparklines,
notable outliers, anomalies, pending proposals, suite pass-rate movements — optionally
with a short Tracey-authored narrative paragraph.

**Why.** Pull-based dashboards decay; a good digest re-engages the team and showcases
exactly the signals Proxytrace uniquely has. Pairs perfectly with C2/C3.

**How it lands.** A scheduled `BackgroundService` (the `TestRunSchedulerService` pattern),
rendering into the existing email channel; narrative generation through the project's
`SystemEndpoint` like other system agents.

**Size.** M.

---

## Theme D — Developer-workflow integration

### D1. CI gate: CLI + GitHub Action ("proxytrace run --fail-under") ⭐

**What.** A small CLI (and a thin GitHub Action wrapper) that runs a named suite against
a *candidate* agent config taken from the PR branch (prompt file / tool descriptions),
waits for completion, and exits non-zero when the pass rate is below a threshold —
posting the per-case results as a PR check summary.

**Why.** The ephemeral-candidate machinery already exists (the A/B validator builds
ephemeral agents; `RunInForegroundAsync` takes `customAgent`), and the MCP/REST API
already exposes runs. Wrapping it into `ci` shape moves Proxytrace from "a tab you
check" into the merge path — the stickiest position a dev tool can occupy. It also
honors the constraint elegantly: the definition still lives in the client's repo; CI is
where the client's definition and Proxytrace's benchmark meet.

**How it lands.** A new API surface for "run suite with this candidate override" (thin
layer over existing internals + a new `ApiKeyScopes` flag), a small distributed CLI
(single static binary or npx), a marketplace Action. Docs + manual page.

**Size.** M (backend S–M, CLI/Action S, polish M).

### D2. Proposal → pull-request handoff

**What.** Optional per-agent mapping (repo, file path, format) so that promoting a
proposal can open a real PR with the prompt change via a GitHub App — instead of copy
buttons and a markdown doc.

**Why.** Stage 4's handoff is the loop's last mile and today it's manual. A PR is the
native unit of change for the people who own the agent definition. Keeps the "client
owns the definition" contract — Proxytrace *proposes* in the client's own medium.

**How it lands.** Extends the existing artifact endpoint/handoff package; GitHub App
credentials per project (encrypted at rest); adoption tracking then observes the merge
land in traffic, exactly as today.

**Size.** M–L (App auth + file-format templating are the bulk).

### D3. OpenTelemetry GenAI export

**What.** Emit ingested traces as OTel GenAI-semconv spans to a configurable OTLP
endpoint, so Proxytrace coexists with Grafana/Datadog/Honeycomb instead of competing
with the platform team's standard stack.

**Why.** Platform teams (a declared target persona) will not replace their
observability stack — but they will happily *add* a spans source. Removes a common
procurement objection; pure interop.

**How it lands.** An export hook after `AgentCallProcessor` persistence (fire-and-forget
queue, never blocking ingestion), OTLP exporter config in admin settings.

**Size.** S–M.

---

## Shortlist — recommended order

| # | Idea | Size | Why now |
|---|------|------|---------|
| 1 | **C2 Webhook/Slack channels** | S | Designed-for seam, immediate daily-use value, ships in days. |
| 2 | **B3 Suggested-case inbox** | M | Compounds existing signals (outliers ✕ promote-flow); makes the core loop self-feeding. |
| 3 | **D1 CI gate** | M | Existing internals, new surface; moves the product into the merge path. |
| 4 | **C3 Version impact reports** | M | The ROI receipt; completes the adoption story with "did it help live?". |
| 5 | **A1 Proposal canary** ⭐ | L | The strategic bet: the proxy stops being a passive recorder; nobody else can do this without owning the request path. |
| 6 | **B1 Multi-turn scenarios** ⭐ | L | The evaluation moat: tests the failures agents actually have. |

A3 (budgets), B4 (feedback), C1 (live monitors) are strong seconds — each is M-sized and
independent, good candidates to interleave. A5 (wire formats) is a funnel play best timed
against demand signals; A2 (guardrails) and D2 (proposal→PR) are larger strategic swings
worth their own design rounds.
