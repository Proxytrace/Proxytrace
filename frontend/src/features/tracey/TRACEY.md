# Tracey — implementation guide

How the in-app Tracey assistant works on the frontend. Read this before changing anything
in `frontend/src/features/tracey/`. It is the source of truth for the chat architecture; the
backend side (call attribution, agent seeding) is documented in
`docs/superpowers/specs/2026-05-31-tracey-client-agent-design.md`.

## What Tracey is

A conversational agent rendered on the full-page **Tracey AI** route. She reads the project's
live state, navigates the user, runs a curated set of actions, and renders rich **inline UI**
in the chat thread (charts/tables/text, entity cards, choice prompts, forms). Her own LLM
calls are routed back through Proxytrace and captured as traces — she is the platform's first
dogfood agent.

## The two planes (the one mental model that matters)

Tracey runs on two independent request paths. Keep them separate in your head:

1. **Reasoning plane (LLM).** The Vercel **AI SDK v6** drives the chat. It POSTs OpenAI-shape
   `/chat/completions` requests to the **same-origin** endpoint
   `/api/tracey/{projectId}/openai/v1` with the app's own JWT. The backend forwards to the
   project's provider and ingests the call. Tools are sent on the wire as JSON Schema (the SDK
   derives them from our zod schemas).
2. **Tool / data plane (browser).** When the model asks for a tool, the tool's `execute`
   handler runs **in the browser** and calls the existing typed `src/api/*.ts` services
   (same-origin, same JWT) or performs a client-side action (`navigate`, append a turn). The
   tool *result* is then rendered inline by the matching component in `components/tool-ui/`
   (mapped by tool name in `components/tool-ui/registry.ts`).

No upstream provider key ever reaches the browser. There is no short-lived key and no CORS —
everything is same-origin under the user's session.

## Single source of truth: tools live on the client

Tool **definitions live only here**, in `tracey-tools.ts`, as zod schema + `execute` handler.
The backend does **not** mirror them: it captures Tracey's prompt + tools from the wire and
attributes the call to her agent by name (`X-Proxytrace-Agent` / same-origin tag). So:

- To add/change/remove a tool, edit **`tracey-tools.ts`** (and `TRACEY_TOOLS_META` for the
  slash menu). That's it on the backend-contract side — no C# tool schema to keep in sync.
- Tracey's **system prompt** lives only in `tracey-prompt.ts` (`TRACEY_SYSTEM_PROMPT`).
- Do **not** reintroduce a backend copy of the prompt or tools. The byte-identical-mirror
  constraint that used to exist is gone by design.

## File map

| File | Role |
|------|------|
| `TraceyAI.tsx` | Page root. Consumes the shared chat via `useTraceyChatContext`, renders status gates, wraps content in `AssistantRuntimeProvider` + `TraceyActionsProvider`, lays out the (single, full-width) chat panel. The one lazy-loaded route component. |
| `useTraceyChat.ts` | **The only stateful hook.** Owns auto-approve, confirmation gating, thread persistence, and builds the runtime. Called **once** from `Shell` (above the router `Outlet`), not from the page — see "Conversation persistence" below. |
| `tracey-chat-context.ts` | Shares the single `TraceyChat` (runtime + conversation) app-wide. `TraceyChatProvider` is mounted in `Shell` around the `Outlet`; `useTraceyChatContext()` reads it from the page. |
| `tracey-runtime.ts` | `TraceyTransport` — the AI SDK `ChatTransport`. Wires `createOpenAI` at the same-origin base URL, injects the JWT per request, runs `streamText` with `stopWhen: stepCountIs(8)`, and adapts our tools into the SDK `ToolSet`. |
| `tracey-tools.ts` | **Single source of truth** for tools: `createTraceyTools(ctx)` returns `{ name → { description, parameters (zod), confirm, execute } }`. `TRACEY_TOOLS_META` is the static name+description list for the slash menu. |
| `tracey-prompt.ts` | `TRACEY_SYSTEM_PROMPT` — her system prompt (wire source of truth). |
| `tracey-artifacts.ts` | Frontend-only render shapes the `show_chart`/`show_table`/`show_text` tools return (chart/table/text). |
| `tracey-storage.ts` | `localStorage` thread persistence keyed by `user + project`. |
| `tracey-actions.tsx` | React context (`navigate`) for assistant-ui message-part components that can't take props. |
| `tracey-quick-actions.ts` | Curated prompt presets ("skills") shown as composer chips + top of the slash menu. |
| `TraceyConversation.tsx` | assistant-ui `Thread`/`Message` primitives styled to DESIGN.md: user bubble, assistant bubble, typing dots, per-tool inline UI (`tools.by_name`) with `ToolCallCard` fallback, empty state. |
| `components/` | `TraceyChatPanel`, `TraceyComposer` (Enter-to-send, `/` slash menu), `SlashMenu`, `ToolChips`, `ToolCallCard`, `MarkdownText`, `artifacts/` renderers, and `tool-ui/` (one inline component per tool + `registry.ts`). |
| `api/tracey.ts` | `getSession()` → `{ model, agentId }` for `GET /api/tracey/session`. |

## How a turn flows

1. User sends a message (or picks a quick action / `/tool` from the composer).
2. `useChatRuntime` (assistant-ui over the AI SDK adapter) calls
   `DelegatingTransport.sendMessages`, which forwards to the live `TraceyTransport` once the
   session has resolved.
3. `TraceyTransport.streamText` sends the conversation + tools to
   `/api/tracey/{projectId}/openai/v1/chat/completions`.
4. If the model emits a tool call, the SDK runs that tool's `execute` **in the browser**;
   `stopWhen: stepCountIs(8)` keeps the loop going (tool → result → model) until Tracey
   answers or the step budget is spent. **Without `stopWhen` the run ends after the first
   step and a tool-first turn produces no text** — don't remove it.
5. Results stream back; `TraceyConversation` renders assistant Markdown, per-tool inline UIs
   (`tools.by_name` → `tool-ui/registry.ts`), and the `ToolCallCard` fallback for the rest.

## Per-response status row

Each finished assistant turn shows `MessageStatusBar` (`components/MessageStatusBar.tsx`) — a quiet
row with the turn's **total tokens + duration**, a `CopyMessageButton`, and an `OpenTraceButton`.

A Tracey turn is a multi-step tool loop (`stopWhen: stepCountIs(8)`), so it makes several upstream
calls — each ingested as its own trace, all sharing the turn's ConversationId. The SDK's
`result.totalUsage` is the usage **aggregated across all those steps** — i.e. the whole turn — so it
matches the sum of the turn's ingested traces (this holds as long as every step is captured; see the
empty-completion note in `OpenAiCallParser`). We therefore read tokens straight from the SDK at the
client: instant, no polling, no async lookup.

- `TraceyTransport.sendMessages` mints one `crypto.randomUUID()` per turn and, on the **finish**
  part of `toUIMessageStream({ messageMetadata })`, writes
  `metadata.custom = { traceConversationId, usage, durationMs }` (`usage` from `part.totalUsage`,
  `durationMs` from wall-clock). Finish-only emission keeps the row hidden while the turn streams.
  The same id also rides every upstream request as the `x-proxytrace-session-id` header, so all of
  the turn's calls share it.
- The backend (`TraceyChatController`) reads that header into `IngestMessage.SessionId`, stored as
  each call's **`ConversationId`** (a non-GUID would be SHA-1 hashed; we send a GUID → verbatim).
- `MessageStatusBar` reads `metadata.custom` once; `message-stats.ts` (`readMessageStats` +
  `readTraceConversationId`, unit-tested) narrows it to `{ inputTokens, outputTokens, totalTokens,
  durationMs }` and the id. Tokens/duration render via `lib/format`.
- `OpenTraceButton` → `useOpenResponseTrace` resolves the ConversationId to the latest call **on
  click** (a single `GET /api/agent-calls` fetch, not a poll) and routes to `/traces?focus=<id>`
  (which expands the turn's conversation group in Traces), or toasts if nothing is ingested yet.
  `CopyMessageButton` copies the assistant text (joined from the message's text parts).

## Conversation persistence

The conversation must survive both in-app navigation and a full page reload. Two layers,
because the AI SDK runtime is in-memory only:

1. **Across navigation (in-memory).** `useTraceyChat` builds the runtime, so whatever component
   calls it owns the runtime's lifetime. It is called **once in `Shell`** — above the router
   `Outlet` — and shared through `TraceyChatProvider` (`tracey-chat-context.ts`). `Shell` stays
   mounted while only the `Outlet` child swaps on navigation, so the runtime (and its messages)
   is never torn down when you leave and return to `/tracey-ai`. **Do not move the
   `useTraceyChat()` call back into `TraceyAI`** — the page unmounts on navigation, which is the
   exact bug this avoids.
2. **Across reload (localStorage).** `useTraceyChat` mirrors the thread to `localStorage`
   (`tracey-storage.ts`, keyed by `user + project`) on every change and re-imports it on mount,
   so a hard reload restores the conversation too.

Because the runtime mounts app-wide, the **session** is provisioned lazily: `useTraceyChat`
only fires the session query (which has backend side effects — Tracey agent provisioning) once
the page calls `activate()` on mount. The flag latches on, so the session stays alive across
navigation; pages the user never opens Tracey from provision nothing. The query also uses
`throwOnError: false` so a failed session can't bubble to an ErrorBoundary and crash the shell —
it surfaces as the contained "error" state on the page. Tracey is unavailable in kiosk mode, so
the session query is additionally disabled when `useKiosk().enabled`.

## Tools: read, write, and render

- **Read tools** (`list_*`, `get_*`, `get_*_stats`) call `src/api/*.ts` and return data.
  `confirm: false`. The single-entity gets (`get_agent`, `get_run`, `get_proposal`,
  `get_provider`, `get_trace`) have a dedicated card component in `tool-ui/`.
- **Write tools** (`start_test_run`, `set_proposal_status`) set `confirm: true`. They call
  `ctx.confirm(summary)` **before** mutating. `useTraceyChat` resolves that promise: when
  auto-approve is OFF it shows an inline Confirm/Cancel card; when ON it resolves `true`
  immediately. A declined write returns the `CANCELLED` sentinel — never call the mutating API
  on cancel.
- **Render tools** (`show_chart`, `show_table`, `show_text`) just **return the render spec**;
  the matching `tool-ui/` component draws it inline.
- **Interactive (human-in-the-loop) tools** (`ask_questions`) define **no `execute`**: the AI SDK
  emits the call and pauses. Their tool-UI component reads `args`, collects input, and calls the
  `addResult(...)` prop (from assistant-ui's `ToolCallMessagePartProps`) to resolve the call — the
  runtime then continues the same assistant turn, with no extra user message. The result also
  drives the read-only summary, so it survives reload.

`TraceyToolContext` (`{ projectId, navigate, confirm }`) is built in
`useTraceyChat` and passed to both `createTraceyTools` (for `execute`) and the SDK tool adapter.
The tool adapter omits `execute` for interactive tools so the SDK treats them as frontend tools.
A tool gets inline UI by adding its component to `tool-ui/registry.ts` (keyed by tool name);
unmapped tools render with `ToolCallCard`.

## Adding or changing a tool (checklist)

1. Add/edit the entry in `createTraceyTools` (`tracey-tools.ts`): `description`, `parameters`
   (zod), `confirm`, `execute`. Reuse an existing `src/api/*.ts` service in `execute` — don't
   add a bespoke fetch.
2. Add/update its entry in `TRACEY_TOOLS_META` so it appears in the slash menu.
3. If it's a write, set `confirm: true` and gate the mutation behind `ctx.confirm(...)`,
   returning `CANCELLED` when declined.
4. If it should render custom inline UI, add a component to `components/tool-ui/` and map it
   in `components/tool-ui/registry.ts` (keyed by the tool name); have `execute` return the
   data the component reads from `result`.
5. If the tool changes what Tracey can do, update `TRACEY_SYSTEM_PROMPT` so she knows about it.
6. No backend change is required for the tool contract — attribution is by name, and the
   version captures whatever tools go over the wire.

## Building an inline tool UI (agentic card)

This is the heart of the "Tracey shows, doesn't narrate" design. A tool gets a rich inline
component by mapping its name to a `ToolCallMessagePartComponent` in
`components/tool-ui/registry.ts`. assistant-ui renders that component in place of the
conversation's `ToolCallCard` fallback. Read this before adding a new card.

### What the component receives

Each `tool-ui/` component is a \`ToolCallMessagePartComponent\` and is handed the live state of
the tool call:

- \`result\` — what the tool's \`execute\` returned (\`undefined\` until it resolves). Use this for
  **read** and **render** tools.
- \`args\` — the model's arguments. Use this for **interactive** tools. **It streams**: during
  generation fields may be missing, so guard before reading (\`if (!args.options) …\`).
- \`status\` (\`{ type }\`), \`isError\` — execution lifecycle.
- \`addResult\`, \`resume\` — only for human-in-the-loop tools (not used today; write
  confirmations still go through the \`useTraceyChat\` modal).

### The three-state pattern

Every card resolves the part into one of three states with the shared helper and renders
through the shared chrome:

\`\`\`tsx
const state = toolUiState(status, isError, result != null); // 'pending' | 'error' | 'ready'
\`\`\`

\`ToolUIFrame\` (in \`tool-ui/ToolUIFrame.tsx\`) draws the card chrome and handles \`pending\`
(spinner + label) and \`error\` (danger line) uniformly, so a component only writes its *ready*
content. \`toolUiState\` lives in \`tool-ui/tool-ui-state.ts\` (a non-component file — keep the
fast-refresh lint rule happy by never exporting a helper from a \`.tsx\` that also exports a
component).

### Three recipes

1. **Entity card (navigable).** Cast \`result\` to the DTO, derive a per-entity color from
   \`lib/colors\`, and wrap in \`EntityCardLink\` — it renders \`ToolUIFrame\` inside a real
   React-Router \`<Link>\` so the whole card is keyboard-focusable and opens the entity's page.
   Build the \`to\` from the real deep-link conventions:

   | Entity | Route |
   |--------|-------|
   | Agent | \`/agents?id=<id>\` |
   | Run | \`/runs?run=<id>\` |
   | Proposal | \`/proposals?agentId=<agentId>\` |
   | Trace | \`/traces?focus=<id>\` |
   | Provider | \`/providers\` |

2. **Render spec.** Have \`execute\` return a plain data spec (see \`show_chart\` returning
   \`{ kind, title, chartType, points }\`) and render it through \`ToolUIFrame\` + an existing
   renderer in \`components/artifacts/\`. Don't recompute SVG/markdown — reuse the renderer.

3. **Interactive (human-in-the-loop).** Give the tool **no `execute`** so the SDK pauses. Read
   \`args\` (guard for partial streaming), collect input in local \`useState\`, and call the
   \`addResult(result)\` prop to resolve the paused call — the runtime continues the turn, no extra
   user message. Drive the "done"/read-only state off the \`result\` prop so it survives reload. See
   \`AskQuestionsToolUI\` (its pure answer/result logic lives in \`ask-questions-logic.ts\`).

### Card rules (DESIGN.md + BEST_PRACTICES.md)

- **Reuse primitives** — \`Card\`, \`Pill\`, \`Badge\`, \`StatusDot\`, \`FormField\`, \`Button\`,
  \`CodeBlock\`, \`DataTable\`. Never hand-roll a card/button/pill.
- **Clickable = real \`<Link>\`/\`<button>\`.** Never \`<div onClick>\`. Entity cards use
  \`EntityCardLink\`; interactive controls use \`Button\`.
- **Color by data, not by string-through-props.** Per-entity hues come from \`agentColor\` /
  \`modelColor\` / \`providerColor\` in \`lib/colors\`; semantic status uses a \`Badge\` *variant*
  (\`success\`/\`warn\`/\`danger\`/\`neutral\`) — don't import another feature's color helper.
- **Tokens only.** No raw hex/px/shadow; inline \`style\` only for a runtime color from
  \`lib/colors\`. No \`any\`, \`as any\`, or \`!\`.
- **\`data-testid\`** on the card root (\`tracey-<thing>-card\`) and every interactive control.
- **One component per file, ≤ 300 lines.** Shared chrome/helpers go in \`ToolUIFrame.tsx\` /
  \`EntityCardLink.tsx\` / \`tool-ui-state.ts\`, not duplicated per card.

### Wiring checklist

1. Add the tool in \`tracey-tools.ts\` (return the data the card reads from \`result\`, or for an
   interactive tool return a \`{ shown: true }\` ack and read \`args\`).
2. Add the component in \`components/tool-ui/\` following the recipe above.
3. Register it in \`components/tool-ui/registry.ts\` (keyed by the tool name). Unmapped tools fall
   back to \`ToolCallCard\` — fine for diagnostic tools like \`navigate\` / \`list_*\`.
4. Teach Tracey about it in \`TRACEY_SYSTEM_PROMPT\` (when to reach for it).
5. Keep \`manual/guide/tracey.md\` in sync.

## Constraints & gotchas

- **`stopWhen` is mandatory** (see step 4). It's the difference between a working agent loop
  and silent tool-first turns.
- **Reasoning models send the system prompt under the `developer` role**, not `system`. That's
  a backend parser concern, but be aware her calls may look different on the wire.
- Hooks can't be conditional, so the runtime is created once with a `DelegatingTransport` and
  the real transport is swapped in after the session query resolves.
- All Tracey state lives in `useTraceyChat`; conversation and `tool-ui/` components stay
  presentational. Data fetching goes through TanStack Query (`api/tracey.ts`) — no raw
  `useEffect`/`fetch`.
- Styling follows DESIGN.md tokens, including the restyled assistant-ui primitives. File-size
  and component rules from BEST_PRACTICES.md apply — split tool UIs into `components/` if a
  file approaches the cap.

## Keep the manual in sync

User-facing behavior is documented in `manual/guide/tracey.md`. Per `CLAUDE.md`, a Tracey
feature change isn't complete until that page matches.
