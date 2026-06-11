# Tracey — implementation guide

How the in-app **Tracey AI** assistant works on the frontend. Read this before changing anything
in `frontend/src/features/tracey/`. It is the source of truth for the chat architecture. Sibling
docs: [`./DESIGN.md`](./DESIGN.md) (visual system) and [`./BEST_PRACTICES.md`](./BEST_PRACTICES.md)
(code architecture). The backend side (call attribution, agent seeding) and the design decisions
behind the harder pieces live in the specs under
[`../../docs/superpowers/specs/`](../../docs/superpowers/specs/) —
`*-tracey-client-agent-design.md` (the planes + name attribution),
`*-tracey-proactive-await-actions-design.md` (`await_actions`), and
`*-tracey-tool-result-store-design.md` (the artifact store). User-facing behavior lives in
[`../../manual/guide/tracey.md`](../../manual/guide/tracey.md).

All paths below are relative to the feature root `frontend/src/features/tracey/` unless noted.

## What Tracey is

A conversational agent rendered on the full-page **Tracey AI** route. She reads the project's live
state, navigates the user, searches the product manual, runs a curated set of read/write actions,
and renders rich **inline UI** in the chat thread (charts/tables/text, entity cards, choice
prompts). Her own LLM calls are routed back through Proxytrace and captured as traces — she is the
platform's first dogfood agent.

Her **defining trait: she shows, she doesn't narrate.** Tools render interactive UI inline; the
ideal reply is a rendered component plus one short sentence of context, never a paragraph of
numbers. This is enforced by `TRACEY_SYSTEM_PROMPT` (`tracey-prompt.ts`) and by every read tool
returning only a compact digest to the model while the full payload is rendered to the user.

## The two planes (the one mental model that matters)

Tracey runs on two independent request paths. Keep them separate in your head:

1. **Reasoning plane (LLM).** The Vercel **AI SDK v6** drives the chat. It POSTs OpenAI-shape
   `/chat/completions` requests to the **same-origin** endpoint
   `/api/tracey/{projectId}/openai/v1` with the app's own JWT. The backend forwards to the
   project's provider and ingests the call. Tools are sent on the wire as JSON Schema (the SDK
   derives them from our zod schemas via `zodSchema`).
2. **Tool / data plane (browser).** When the model asks for a tool, the tool's `execute` handler
   runs **in the browser** and calls the existing typed `src/api/*.ts` services (same-origin, same
   JWT) or performs a client-side action (`navigate`, append a turn). The tool *result* is then
   rendered inline by the matching component in `components/tool-ui/` (mapped by tool name in
   `components/tool-ui/registry.ts`).

No upstream provider key ever reaches the browser. There is no short-lived key and no CORS —
everything is same-origin under the user's session.

## Single source of truth: tools live on the client

Tool **definitions live only here**, grouped by domain under `tools/*.ts`, each a zod schema +
`execute` handler. The backend does **not** mirror them: it captures Tracey's prompt + tools from
the wire and attributes the call to her agent by name (`X-Proxytrace-Agent` / same-origin tag). So:

- To add/change/remove a tool, edit the domain factory in `tools/` and the `TRACEY_TOOLS_META`
  list in `tracey-tools.ts` (for the slash menu). No C# tool schema to keep in sync.
- Tracey's **system prompt** lives only in `tracey-prompt.ts` (`TRACEY_SYSTEM_PROMPT`).
- Do **not** reintroduce a backend copy of the prompt or tools. The byte-identical-mirror
  constraint that used to exist is gone by design.

## File map

| File | Role |
|------|------|
| `TraceyAI.tsx` | Page root. Consumes the shared chat via `useTraceyChatContext`, calls `activate()` on mount, renders status gates (no-project / loading / error / ready), wraps content in `AssistantRuntimeProvider` + `TraceyActionsProvider`, lays out the single full-width chat panel. The one lazy-loaded route component. |
| `useTraceyChat.ts` | **The only stateful hook.** Owns auto-approve, confirmation gating, thread persistence, artifact lifecycle, the lazy session query, and builds the runtime. Called **once** from `Shell` (above the router `Outlet`), not from the page — see "Conversation persistence". |
| `tracey-chat-context.ts` | Shares the single `TraceyChat` (runtime + state) app-wide. `TraceyChatProvider` mounts in `Shell` around the `Outlet`; `useTraceyChatContext()` reads it from the page. |
| `tracey-runtime.ts` | `TraceyTransport` — the AI SDK `ChatTransport`. Wires `createOpenAI` at the same-origin base URL, injects the JWT + turn-correlation header per request, windows the history sent to the model (`windowMessages`, UI thread untouched), runs `streamText` with `prepareStep` (progressive tool disclosure) + `stopWhen: stepCountIs(MAX_TURN_STEPS)` (12), adapts our tools into the SDK `ToolSet` (threading the abort signal), and writes per-turn metadata on finish. |
| `tracey-tools.ts` | **Composition root** for tools: `createTraceyTools(ctx)` wires every `tools/*` domain factory against a shared artifact store. `TRACEY_TOOLS_META` is the static name+description list for the slash menu (must list every tool). |
| `tools/` | Per-domain tool factories: `navigation.ts` (navigate, search_docs, load_skill), `agents.ts`, `suites.ts`, `runs.ts`, `proposals.ts`, `stats.ts`, `providers.ts`, `traces.ts`, `display.ts` (show_*, ask_questions), `await.ts` (await_actions). `shared.ts` holds `TraceyToolContext`, the `tool()`/`empty`/`CANCELLED` helpers, and `makeStore`. `poll-until-terminal.ts` backs `await`; `run-analysis.ts` holds the pure failure/comparison derivations behind `get_run_failures`/`compare_runs` (verdicts reuse `features/runs/results.ts`). |
| `tool-access.ts` | **Progressive tool disclosure.** `CORE_TOOL_NAMES` (always active) + `activeToolNamesFor(loadedSkillIds)` (core ∪ the tool bundles of skills loaded this conversation). |
| `tracey-prompt.ts` | `TRACEY_SYSTEM_PROMPT` — her system prompt (wire source of truth), with the skill catalog appended. |
| `skills/` | On-demand **skills** — markdown playbooks loaded at runtime via `load_skill`. `registry.ts` parses front-matter (`name`, `description`, optional `tools:` bundle) from every `*.md` via `import.meta.glob`; `types.ts`; one file per skill. |
| `knowledge/` | Product-manual search for `search_docs`. `docs-index.generated.ts` is the build-time index of the VitePress manual; `search-docs.ts` does token-overlap ranking; `types.ts`. |
| `tracey-artifact-store.ts` | The browser **artifact store** (IndexedDB → localStorage fallback). Holds large tool payloads so only a compact reference + digest enters the model context; cards resolve the reference to render the full data. |
| `tracey-artifact-kinds.ts` | The **typed artifact contract**: `ArtifactPayloads` maps every artifact `kind` to its payload type. `StoreFn` only accepts the matching shape and `useArtifactResult(kind, …)` returns it (verifying the kind at runtime), so a tool and its card can't silently disagree (e.g. list-item DTO vs full DTO). |
| `tracey-artifacts.ts` | Frontend-only render shapes the `show_chart`/`show_table`/`show_text` tools return. |
| `tracey-storage.ts` | `localStorage` thread persistence keyed by `user + project`. |
| `tracey-actions.tsx` | React context (`navigate`) for assistant-ui message-part components that can't take props. |
| `tracey-quick-actions.ts` | Curated prompt presets shown as composer chips + top of the slash menu. |
| `message-stats.ts` | `readMessageStats` + `readTraceConversationId` — narrows `metadata.custom` to tokens/duration/`stoppedEarly` (step budget hit) + the trace id (unit-tested). |
| `useArtifact.ts` / `useOpenResponseTrace.ts` | Hook to resolve a stored artifact for a card; hook behind `OpenTraceButton`. |
| `TraceyConversation.tsx` | assistant-ui `Thread`/`Message` primitives styled to DESIGN.md: user/assistant bubbles, an end-of-thread "Thinking…" busy indicator while a turn runs, per-tool inline UI (`tools.by_name`) with `ToolCallCard` fallback, empty state. |
| `components/` | `TraceyChatPanel`, `TraceyComposer` (Enter-to-send, `/` slash menu), `SlashMenu`, `ToolChips`, `ToolCallCard`, `AssistantMessage`/`UserMessage`, `MarkdownText`, `MessageStatusBar`, `CopyMessageButton`, `OpenTraceButton`, `artifacts/` renderers, and `tool-ui/` (one inline component per tool + `registry.ts`). |
| `api/tracey.ts` | `getSession()` → `{ model, agentId }` for `GET /api/tracey/session`. |

## How a turn flows

1. User sends a message (or picks a quick action / `/tool` from the composer).
2. `useChatRuntime` (assistant-ui over the AI SDK adapter) calls `DelegatingTransport.sendMessages`,
   which forwards to the live `TraceyTransport` once the session has resolved.
3. `TraceyTransport.sendMessages` mints one `crypto.randomUUID()` for the turn, sets it as the
   `x-proxytrace-session-id` header, and runs `streamText` against
   `/api/tracey/{projectId}/openai/v1/chat/completions` with the system prompt, the conversation,
   and the full tool set — but `prepareStep` restricts the **active** tools per step (see
   "Progressive tool disclosure").
4. If the model emits a tool call, the SDK runs that tool's `execute` **in the browser**;
   `stopWhen: stepCountIs(MAX_TURN_STEPS)` (12) keeps the loop going (tool → result → model)
   until Tracey answers or the step budget is spent. **Without `stopWhen` the run ends after the
   first step and a tool-first turn produces no text** — don't remove it. A budget-truncated turn
   finishes with `finishReason: 'tool-calls'`, which `MessageStatusBar` surfaces as a "Step limit
   reached" notice.
5. Results stream back; `TraceyConversation` renders assistant Markdown, per-tool inline UIs
   (`tools.by_name` → `tool-ui/registry.ts`), and the `ToolCallCard` fallback for the rest.
6. On the stream's **finish** part, `toUIMessageStream({ messageMetadata })` writes
   `metadata.custom = { traceConversationId, usage, durationMs }`, which drives `MessageStatusBar`.

## Progressive tool disclosure (skills gate tools)

The full tool set is large, so Tracey only ever *offers* a lean subset to the model on a given
step. Every tool is always **defined** (so the wire capture and her versioned agent stay complete),
but `tracey-runtime.ts`'s `prepareStep` sets `activeTools` to the core set plus the bundles of
every skill loaded **so far this conversation** (`tool-access.ts`):

- **`CORE_TOOL_NAMES`** are active on every step: `navigate`, `search_docs`, `load_skill`,
  `ask_questions`, the three `show_*` renderers, and the two universal agent reads (`list_agents`,
  `get_agent`).
- **Everything else is gated behind a skill.** A skill's front-matter `tools:` list is its
  *bundle*; loading the skill with `load_skill` unlocks that bundle for the **rest of the
  conversation**, not just the turn. At the start of each turn the transport re-derives the loaded
  set from the message history (`skillIdsFromMessages` — `load_skill` parts whose result wasn't
  `notFound`), unions it with the current turn's `load_skill` calls (`loadedSkillIds(steps)`), and
  mirrors it into `ctx.loadedSkillIds`. Because it comes from the messages, it survives a page
  reload and resets with the thread.
- **Repeat loads are no-ops.** `load_skill` checks `ctx.loadedSkillIds` and answers an
  already-loaded skill with a compact `{ alreadyLoaded: true }` instead of re-injecting the full
  playbook; the prompt tells the model a skill stays loaded and never to load it twice.

This gives a dispatcher feel without a second model: the lean core handles routing + simple
agent/doc questions; a request that needs suites, runs, proposals, stats, providers, traces, or any
write makes the model `load_skill` first, which then exposes that task's tools. The tests in
`tool-access.spec.ts` assert no defined tool is permanently unreachable (it must live in core or
some skill bundle).

## Tool catalog

`confirm: true` tools mutate state and route through the confirmation gate (below). The **Skill**
column is which bundle activates the tool (`core` = always available).

| Tool | Kind | Confirm | Skill | Inline UI |
|------|------|---------|-------|-----------|
| `navigate` | client action | no | core | `ToolCallCard` |
| `search_docs` | knowledge read | no | core | `ToolCallCard` |
| `load_skill` | meta | no | core | hidden (renders nothing) |
| `list_agents` / `get_agent` | read | no | core | `AgentListToolUI` / `AgentCardToolUI` |
| `show_chart` / `show_table` / `show_text` | render | no | core | `ChartToolUI` / `TableToolUI` / `TextToolUI` |
| `ask_questions` | interactive (HITL) | no | core | `AskQuestionsToolUI` |
| `list_suites` / `get_suite` | read | no | `test-suites-and-runs` | `SuiteListToolUI` / `SuiteCardToolUI` |
| `list_runs` / `get_run` | read | no | `test-suites-and-runs` | `RunListToolUI` / `RunCardToolUI` |
| `get_run_failures` | read (analysis) | no | `test-suites-and-runs`, `optimize-agent` | `RunFailuresToolUI` |
| `compare_runs` | read (analysis) | no | `test-suites-and-runs`, `optimize-agent` | `RunComparisonToolUI` |
| `start_test_run` | write | **yes** | `test-suites-and-runs` | `StartTestRunToolUI` (live) |
| `list_proposals` / `get_proposal` | read | no | `review-proposals` | `ProposalListToolUI` / `ProposalCardToolUI` |
| `set_proposal_status` | write | **yes** | `review-proposals` | `ToolCallCard` |
| `list_theories` | read | no | `optimize-agent` | `TheoryListToolUI` |
| `get_dashboard_stats` | read | no | `project-insights` | `DashboardStatsToolUI` |
| `get_provider` | read | no | `project-insights` | `ProviderCardToolUI` |
| `find_traces` | read (search) | no | `project-insights`, `optimize-agent` | `TraceListToolUI` |
| `get_trace` | read | no | `project-insights`, `optimize-agent` | `TraceCardToolUI` |
| `get_agent_stats` | read | no | `optimize-agent` | `AgentStatsToolUI` |
| `submit_optimization_theory` | write | **yes** | `optimize-agent` | `TheoryToolUI` (live) |
| `await_actions` | wait | no | `test-suites-and-runs`, `optimize-agent` | `AwaitActionsToolUI` |

## Tools: read, write, render, wait, interactive

`TraceyToolContext` (`{ projectId, artifactScope, navigate, confirm }`, `tools/shared.ts`) is
built in `useTraceyChat` and passed to both `createTraceyTools` (for `execute`) and the SDK tool
adapter. Each domain factory also receives a `StoreFn` bound to the artifact store.

- **Read tools** (`list_*`, `get_*`, `get_*_stats`) call `src/api/*.ts`, push the full payload to
  the artifact store, and return only a compact digest + reference. `confirm: false`. The
  single-entity gets (`get_agent`, `get_run`, `get_proposal`, `get_provider`, `get_trace`,
  `get_suite`) each have a dedicated card in `tool-ui/`. Digests deliberately carry enough to
  answer follow-ups without more cards: list digests include the key row fields **but are capped**
  (`listDigest` in `tools/shared.ts` — first 20–25 rows + total count + a truncation note; the
  card always shows everything), and
  `get_dashboard_stats` includes `byAgent`/`byModel` usage breakdowns so a cross-agent usage chart
  needs one read, not `get_agent_stats` per agent (the prompt's "card economy" rules lean on
  this).
- **Write tools** (`start_test_run`, `set_proposal_status`, `submit_optimization_theory`) set
  `confirm: true`. They call `ctx.confirm(summary)` **before** mutating; on decline they return the
  `CANCELLED` sentinel and never touch the mutating API. Their results are digests too:
  `start_test_run` and `submit_optimization_theory` store the created entity as an artifact and
  return only identity fields + the `awaitable` handle (the theory in particular would otherwise
  echo the full proposed change the model just authored straight back into its context);
  `set_proposal_status` returns just `{ id, status }`.
- **Missing entities (404).** Every by-id lookup (reads and the write tools' pre-mutation
  lookups) passes `silentStatuses: [404]` and maps a 404 to a compact `{ notFound: id }` result
  (`ignore404`, `tools/shared.ts`) instead of throwing — no red error toast for a
  model-recoverable miss (stale id, deleted entity, run-vs-group id mix-up), and the model can
  re-list or ask instead of parsing an opaque error. `useArtifactResult` renders any inline
  `{ notFound }` as the card's error state, so cards need no per-card guard. `await_actions`
  polls with the same silence; a bad handle still lands in its per-handle `errors`.
- **Render tools** (`show_chart`, `show_table`, `show_text`) take the data as args and return only
  a stored render spec; the matching `tool-ui/` component draws it via a `components/artifacts/`
  renderer.
- **Wait tool** (`await_actions`) — see its own section below.
- **Interactive (human-in-the-loop) tools** (`ask_questions`) define **no `execute`**. The SDK
  emits the call and pauses; the tool-UI reads `args`, collects input, and calls `addResult(...)`
  to resolve the call. `useChatRuntime` is configured with
  `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls`, so the runtime
  auto-resubmits and the model continues the **same** assistant turn with no extra user message.
  The result also drives the read-only summary, so it survives reload.

A tool gets inline UI by adding its component to `tool-ui/registry.ts` (keyed by tool name);
unmapped tools render with `ToolCallCard` (fine for `navigate`, `search_docs`,
`set_proposal_status`). `load_skill` is mapped to a hidden component (`HiddenToolUI`, renders
nothing) — it's plumbing, not something the user should see in the thread. The runtime's tool adapter omits `execute` for interactive tools so the
SDK treats them as frontend tools, and passes the SDK abort signal into `execute` so long-running
tools stop when the user stops the turn.

## Confirmation gate & auto-approve

All write tools funnel through `useTraceyChat`'s `confirm(summary)`:

- **Auto-approve ON (default):** `confirm` resolves `true` immediately — no prompt. The toggle is
  in the chat panel; the preference is persisted in `localStorage` (`tracey-storage.ts`,
  `loadAutoApprove`/`saveAutoApprove`) and `autoApproveRef` keeps the latest value visible to the
  async tool closure.
- **Auto-approve OFF:** `confirm` returns a promise and sets `pendingConfirmation`. The
  page renders an inline Confirm/Cancel card; `resolveConfirmation(true|false)` settles the promise.
  The tool proceeds only on `true`, else returns `CANCELLED`.

Confirmation is gated in the **tool layer** (not the model), so the model can't bypass it.

## The artifact store (keeping the model context lean)

Read/render tool results can be large (full DTOs, tables, traces). Putting them in the model
context would blow the budget and slow every step. So tools stash the full payload in the browser
**artifact store** (`tracey-artifact-store.ts`) and hand the model only a compact reference +
digest:

- `makeStore(ctx)` (`tools/shared.ts`) wraps `storeArtifact(scope, kind, full, summary)`. The
  model sees `summary` (counts, ids, key fields) plus a reference; the user sees the **full** data,
  because the inline card resolves the reference via `useArtifact` and renders it.
- Storage is **IndexedDB with a localStorage fallback**; if both are unavailable, `makeStore`
  swallows the error and returns the full payload inline — the card still renders, only that
  last-resort path costs model context.
- Artifacts are scoped by `artifactScope = "${userKey}:${projectKey}"` so a thread reset
  (`clearArtifacts`) wipes exactly this user+project's blobs. On mount, `useTraceyChat` prunes
  artifacts the restored thread no longer references (`collectArtifactRefs` → `pruneArtifacts`),
  but only at mount — pruning mid-stream could race a just-written blob.

`await_actions` and `navigate` deliberately return inline (their results are already compact and
have no resolving card).

## Wait tool: `await_actions` (proactive long-running actions)

Test runs and optimization theories run for minutes on the backend. Rather than ending the turn and
making the user re-prompt, Tracey can **wait inside the same turn** and react when they finish:

- The producing write tools return an `awaitable: { kind, id }` handle in their digest
  (`start_test_run` → `{ kind: 'test-run', id }`, `submit_optimization_theory` →
  `{ kind: 'theory', id }`).
- The same-turn wait is **enforced, not just instructed**: `prepareStep` (`tracey-runtime.ts`)
  scans the turn's steps for `awaitable` handles no `await_actions` call has covered yet
  (`pendingAwaitables`) and, while any are pending, forces the next step with
  `toolChoice: { type: 'tool', toolName: 'await_actions' }`. The model can't end the turn with
  "the run has started" and leave the user to re-prompt for the outcome; it still authors the
  args, so it batches every pending handle into the one call. Cancelled / not-found writes return
  no handle and never force a wait; a wrong or missed id just re-forces on the next step, capped
  by the step budget.
- Because the wait is forced right after any producing step, the prompts tell the model to start
  ALL the actions it intends to run in the **same step** (parallel tool calls), then call
  `await_actions` **once** with every handle (never per-action, never poll itself).
- `await.ts` polls each handle to a terminal state via `poll-until-terminal.ts` — runs:
  `Completed`/`Failed`/`Cancelled`; theories: `Validated`/`Invalidated` — at a 3 s interval with a
  **10-minute per-handle cap**. A capped handle returns `timedOut: true` rather than hanging.
- It returns one compact aggregate (`{ results, errors?, anyTimedOut }`) with per-run pass/fail
  counts and per-theory resulting proposal id, so Tracey can summarize and act in the same turn.
  Failures are captured **per handle** (a bad id or network error lands in `errors`), so one bad
  handle can't lose the other results.
- The wait honors the turn's **abort signal**: hitting Stop cancels the polling immediately
  instead of letting it run to the cap in the background.
- `confirm: false`. Its inline card (`AwaitActionsToolUI`) lists the awaited handles with a
  spinner while waiting and one status row per action when done (timed-out → warn, failed handle →
  danger); the per-item **live** cards (`StartTestRunToolUI`, `TheoryToolUI`) still stream the
  detailed progress.

## Live cards (streaming write results)

Two write tools have cards that **stream** backend progress into the chat after the call returns,
patching the relevant query cache (never refetching — see DESIGN.md §8 / BEST_PRACTICES.md):

- **`StartTestRunToolUI`** → `LiveRunCard` via `useLiveTestRunGroup`: streams completion + pass/fail
  per case as the run executes; `live-run-progress.ts` derives the aggregate.
- **`TheoryToolUI`** → `LiveTheoryCard` via `useLiveTheory`/`useTheoryStream`: streams the A/B
  validation status into the `theory(id)` cache; `TheoryChangePreview` shows the proposed change.

## Per-response status row

Each finished assistant turn shows `MessageStatusBar` — a quiet row with the turn's **total tokens
+ duration**, a `CopyMessageButton`, and an `OpenTraceButton`.

A Tracey turn is a multi-step tool loop, so it makes several upstream calls — each ingested as its
own trace, all sharing the turn's ConversationId. The SDK's `part.totalUsage` is the usage
aggregated **across all steps** (the whole turn), so it matches the sum of the turn's ingested
traces. We read tokens straight from the SDK at the client: instant, no polling.

- `TraceyTransport` writes `metadata.custom = { traceConversationId, usage, durationMs,
  finishReason }` on the **finish** part only (so the row stays hidden while streaming). A
  `finishReason` of `'tool-calls'` means the step budget truncated the turn; the row then shows a
  warn-colored "Step limit reached" notice. The same turn id rides every
  upstream request as `x-proxytrace-session-id`, so the turn's calls share it.
- The backend (`TraceyChatController`) reads that header into `IngestMessage.SessionId`, stored as
  each call's **`ConversationId`** (a GUID is stored verbatim; a non-GUID would be SHA-1 hashed).
- `MessageStatusBar` reads `metadata.custom` once; `message-stats.ts` narrows it to
  `{ inputTokens, outputTokens, totalTokens, durationMs }` + the id; values render via `lib/format`.
- `OpenTraceButton` → `useOpenResponseTrace` resolves the ConversationId to the latest call **on
  click** (one `GET /api/agent-calls`, not a poll) and routes to `/traces?focus=<id>` (expanding the
  turn's conversation group in Traces), or toasts if nothing is ingested yet. `CopyMessageButton`
  copies the assistant text (joined from the message's text parts).

## Conversation persistence

The conversation must survive both in-app navigation and a full page reload. Two layers, because
the AI SDK runtime is in-memory only:

1. **Across navigation (in-memory).** `useTraceyChat` builds the runtime, so whatever component
   calls it owns the runtime's lifetime. It is called **once in `Shell`** — above the router
   `Outlet` — and shared through `TraceyChatProvider`. `Shell` stays mounted while only the
   `Outlet` child swaps on navigation, so the runtime (and its messages) is never torn down when
   you leave and return to `/tracey-ai`. **Do not move the `useTraceyChat()` call back into
   `TraceyAI`** — the page unmounts on navigation, which is the exact bug this avoids.
The **model**, however, never sees the whole thread: `TraceyTransport` sends only the last
`MODEL_HISTORY_WINDOW` (30) messages per turn, cut at a user-message boundary (`windowMessages`),
so per-turn token cost stops growing with conversation age. The UI thread and the persisted
snapshot stay complete. The loaded-skill set is derived from the same window, so a playbook that
slid out of context counts as unloaded and a reload returns the full instructions again.

2. **Across reload (localStorage).** `useTraceyChat` mirrors the thread to `localStorage`
   (`tracey-storage.ts`, keyed by `user + project`) on every change and re-imports it on mount, so
   a hard reload restores the conversation. Artifacts the restored thread still references are kept;
   orphans are pruned (see the artifact store).

Because the runtime mounts app-wide, the **session** is provisioned lazily: the session query has
backend side effects (Tracey agent provisioning), so it only fires once the page calls `activate()`
on mount. The flag latches on, so the session stays alive across navigation; pages the user never
opens Tracey from provision nothing. The query uses `throwOnError: false` so a failed session can't
bubble to an ErrorBoundary and crash the shell — it surfaces as the contained "error" state on the
page. The session is also gated on `useKiosk().interactive`, since Tracey makes real LLM calls and
is unavailable in non-interactive kiosk mode.

## Skills (on-demand playbooks + tool bundles)

A **skill** is a named markdown playbook the model loads at runtime instead of carrying in the base
prompt. The system prompt advertises only a compact catalog (`name — description`, built by
`skillCatalog()`); the body arrives as the `load_skill` tool result when the model decides a task
matches, **and** loading it unlocks that skill's tool bundle for the rest of the turn (see
"Progressive tool disclosure"). This keeps `TRACEY_SYSTEM_PROMPT` lean and the per-step tool list
sharp as the catalog grows.

Current skills (`skills/*.md`):

| Skill (`name`) | Unlocks (`tools:`) |
|----------------|--------------------|
| `test-suites-and-runs` | `list_suites`, `get_suite`, `list_runs`, `get_run`, `get_run_failures`, `compare_runs`, `start_test_run`, `await_actions` |
| `review-proposals` | `list_proposals`, `get_proposal`, `set_proposal_status` |
| `project-insights` | `get_dashboard_stats`, `get_provider`, `find_traces`, `get_trace` |
| `optimize-agent` | `submit_optimization_theory`, `get_agent_stats`, `list_suites`, `list_runs`, `get_run`, `get_run_failures`, `compare_runs`, `find_traces`, `get_trace`, `list_theories`, `await_actions` |

- **Add a skill:** drop a `skills/<name>.md` with YAML front-matter (`name`, `description`, optional
  `tools:` — a comma/space-separated bundle) and the playbook as the body. `registry.ts`
  `import.meta.glob`s every `*.md` and parses the front-matter — no registration code, no prompt
  edit, no backend change. It's auto-listed in the catalog and loadable, and its `tools:` are
  auto-gated.
- **`load_skill`** (core tool, no confirm) returns `{ name, instructions }`,
  `{ name, alreadyLoaded, note }` for a skill already loaded this conversation (the playbook is
  not re-injected), or `{ notFound, available }` for an unknown id.
- The **`optimize-agent`** skill drives `submit_optimization_theory`: verify the agent + its suite,
  ground a hypothesis in real run/trace evidence, author one change, submit it. The submit tool
  posts to `POST /api/theories` (`source: TraceyAi`); the backend A/B-validates it and either spawns
  a Draft proposal or invalidates it. `TheoryToolUI` → `LiveTheoryCard` streams that status.

## Product-manual search (`search_docs`)

`search_docs` answers how-to / what-is / setup / conceptual questions about Proxytrace **itself**
(not the user's data). It searches a build-time index of the VitePress manual:

- `knowledge/docs-index.generated.ts` is the generated index (one entry per manual section, with
  its `/docs/...` `url`). `search-docs.ts` tokenizes the query and ranks sections by token overlap,
  returning short snippets.
- The system prompt makes the read/answer split sharp — data tools for the user's agents/runs/stats,
  `search_docs` for how the product works — and **requires citing** the returned `url` as an inline
  markdown link, never inventing a docs URL.

## Building an inline tool UI (agentic card)

This is the heart of the "Tracey shows, doesn't narrate" design. A tool gets a rich inline
component by mapping its name to a `ToolCallMessagePartComponent` in `components/tool-ui/registry.ts`.
assistant-ui renders that component in place of the `ToolCallCard` fallback.

### What the component receives

Each `tool-ui/` component is a `ToolCallMessagePartComponent`, handed the live state of the call:

- `result` — what the tool's `execute` returned (`undefined` until it resolves) — typically the
  digest + an artifact reference. Use this for **read** and **render** tools; resolve the reference
  with `useArtifact` to get the full payload.
- `args` — the model's arguments. Use this for **interactive** tools. **It streams**: during
  generation fields may be missing, so guard before reading (`if (!args.options) …`).
- `status` (`{ type }`), `isError` — execution lifecycle.
- `addResult` — for human-in-the-loop tools: call it with the collected input to resolve the paused
  call and continue the turn.

### The three-state pattern

Resolve the part into one of three states and render through the shared chrome:

```tsx
const state = toolUiState(status, isError, result != null); // 'pending' | 'error' | 'ready'
```

`ToolUIFrame` (`tool-ui/ToolUIFrame.tsx`) draws the card chrome and handles `pending` (spinner +
label) and `error` (danger line) uniformly, so a component only writes its *ready* content.
`toolUiState` lives in `tool-ui/tool-ui-state.ts` (a non-component file — never export a helper from
a `.tsx` that also exports a component, or you break the fast-refresh lint rule).

### Three recipes

1. **Entity card (navigable).** Resolve `result` to the DTO, derive a per-entity color from
   `lib/colors`, and wrap in `EntityCardLink` — it renders `ToolUIFrame` inside a real
   React-Router `<Link>`, so the whole card is keyboard-focusable and opens the entity's page.
   Build `to` from the deep-link conventions:

   | Entity | Route |
   |--------|-------|
   | Agent | `/agents?id=<id>` |
   | Run | `/runs?run=<id>` |
   | Proposal | `/proposals?agentId=<agentId>` |
   | Trace | `/traces?focus=<id>` |
   | Provider | `/providers` |

2. **Render spec.** Have `execute` return a plain data spec (e.g. `show_chart` →
   `{ kind, title, chartType, points }`) and render it through `ToolUIFrame` + an existing renderer
   in `components/artifacts/`. Don't recompute SVG/markdown — reuse the renderer.

3. **Interactive (human-in-the-loop).** Give the tool **no `execute`** so the SDK pauses. Read
   `args` (guard for partial streaming), collect input in local `useState`, and call `addResult(...)`
   to resolve the paused call. Drive the "done"/read-only state off the `result` prop so it survives
   reload. See `AskQuestionsToolUI` (pure logic in `ask-questions-logic.ts`).

### Card rules (DESIGN.md + BEST_PRACTICES.md)

- **Reuse primitives** — `Card`, `Pill`, `Badge`, `StatusDot`, `FormField`, `Button`, `CodeBlock`,
  `DataTable`. Never hand-roll a card/button/pill.
- **Clickable = real `<Link>`/`<button>`.** Never `<div onClick>`. Entity cards use `EntityCardLink`;
  interactive controls use `Button`.
- **Color by data, not string-through-props.** Per-entity hues come from `agentColor`/`modelColor`/
  `providerColor` in `lib/colors`; semantic status uses a `Badge` *variant*
  (`success`/`warn`/`danger`/`neutral`).
- **Tokens only.** No raw hex/px/shadow; inline `style` only for a runtime color from `lib/colors`.
  No `any`, `as any`, or `!`.
- **`data-testid`** on the card root (`tracey-<thing>-card`) and every interactive control.
- **One component per file, ≤ 300 lines.** Shared chrome/helpers go in `ToolUIFrame.tsx` /
  `EntityCardLink.tsx` / `tool-ui-state.ts`, not duplicated per card.

## Adding or changing a tool (checklist)

1. Add/edit the entry in the matching `tools/*.ts` factory: `description`, `parameters` (zod),
   `confirm`, `execute`. Reuse an existing `src/api/*.ts` service in `execute` — don't add a bespoke
   fetch. For read/render tools, push the full payload through the `store` and return a compact
   digest (+ a reference, + an `awaitable` handle if it's a long-running write).
2. Add/update its entry in `TRACEY_TOOLS_META` (`tracey-tools.ts`) so it appears in the slash menu.
3. **Disclosure:** unless it belongs in `CORE_TOOL_NAMES`, add the tool name to a skill's `tools:`
   bundle in `skills/<skill>.md` — otherwise it's defined but never offered to the model.
4. If it's a write, set `confirm: true` and gate the mutation behind `ctx.confirm(...)`, returning
   `CANCELLED` when declined.
5. If it should render custom inline UI, add a component to `components/tool-ui/` and map it in
   `components/tool-ui/registry.ts` (keyed by the tool name); have `execute` return the data the
   component reads from `result`.
6. If the tool changes what Tracey can do, update `TRACEY_SYSTEM_PROMPT` (and/or the relevant skill
   body) so she knows about it and when to reach for it.
7. No backend change is required for the tool contract — attribution is by name, and the captured
   version records whatever tools go over the wire.

## Constraints & gotchas

- **`stopWhen` is mandatory** (turn step 4). It's the difference between a working agent loop and
  silent tool-first turns.
- **`prepareStep` is mandatory too** — without it the model sees the full tool set every step,
  defeating disclosure. Keep `CORE_TOOL_NAMES` lean.
- **A defined-but-ungated tool is dead.** If a new tool is neither core nor in any skill bundle, the
  model can never call it. `tool-access.spec.ts` guards this.
- **Reasoning models send the system prompt under the `developer` role**, not `system`. A backend
  parser concern, but be aware her calls may look different on the wire.
- Hooks can't be conditional, so the runtime is created once with a `DelegatingTransport` and the
  real transport is swapped in after the session query resolves.
- All Tracey state lives in `useTraceyChat`; conversation and `tool-ui/` components stay
  presentational. Data fetching goes through TanStack Query — no raw `useEffect`/`fetch`.
- Styling follows DESIGN.md tokens, including the restyled assistant-ui primitives. File-size and
  component rules from BEST_PRACTICES.md apply — split tool UIs into `components/` if a file
  approaches the cap.

## Keep the manual in sync

User-facing behavior is documented in [`../../manual/guide/tracey.md`](../../manual/guide/tracey.md).
Per `CLAUDE.md`, a Tracey feature change isn't complete until that page matches.
