# Tracey — implementation guide

How the in-app Tracey assistant works on the frontend. Read this before changing anything
in `frontend/src/features/tracey/`. It is the source of truth for the chat architecture; the
backend side (call attribution, agent seeding) is documented in
`docs/superpowers/specs/2026-05-31-tracey-client-agent-design.md`.

## What Tracey is

A conversational agent rendered on the full-page **Tracey AI** route. She reads the project's
live state, navigates the user, runs a curated set of actions, and renders artifacts
(charts/tables/text) in a right-hand split panel. Her own LLM calls are routed back through
Proxytrace and captured as traces — she is the platform's first dogfood agent.

## The two planes (the one mental model that matters)

Tracey runs on two independent request paths. Keep them separate in your head:

1. **Reasoning plane (LLM).** The Vercel **AI SDK v6** drives the chat. It POSTs OpenAI-shape
   `/chat/completions` requests to the **same-origin** endpoint
   `/api/tracey/{projectId}/openai/v1` with the app's own JWT. The backend forwards to the
   project's provider and ingests the call. Tools are sent on the wire as JSON Schema (the SDK
   derives them from our zod schemas).
2. **Tool / data plane (browser).** When the model asks for a tool, the tool's `execute`
   handler runs **in the browser** and calls the existing typed `src/api/*.ts` services
   (same-origin, same JWT) or performs a client-side action (`navigate`, render an artifact).

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
| `TraceyAI.tsx` | Page root. Renders status gates, wraps content in `AssistantRuntimeProvider` + `TraceyActionsProvider`, lays out chat panel + artifact panel. The one lazy-loaded route component. |
| `useTraceyChat.ts` | **The only stateful hook.** Owns auto-approve, confirmation gating, artifacts, thread persistence, and builds the runtime. Everything else is presentational or data. |
| `tracey-runtime.ts` | `TraceyTransport` — the AI SDK `ChatTransport`. Wires `createOpenAI` at the same-origin base URL, injects the JWT per request, runs `streamText` with `stopWhen: stepCountIs(8)`, and adapts our tools into the SDK `ToolSet`. |
| `tracey-tools.ts` | **Single source of truth** for tools: `createTraceyTools(ctx)` returns `{ name → { description, parameters (zod), confirm, execute } }`. `TRACEY_TOOLS_META` is the static name+description list for the slash menu. |
| `tracey-prompt.ts` | `TRACEY_SYSTEM_PROMPT` — her system prompt (wire source of truth). |
| `tracey-artifacts.ts` | Frontend-only artifact model (chart/table/text) + `resultToArtifact` coercion for pinning a raw tool result. |
| `tracey-storage.ts` | `localStorage` thread persistence keyed by `user + project`. |
| `tracey-actions.tsx` | React context (`showArtifact`) for assistant-ui message-part components that can't take props. |
| `tracey-quick-actions.ts` | Curated prompt presets ("skills") shown as composer chips + top of the slash menu. |
| `TraceyConversation.tsx` | assistant-ui `Thread`/`Message` primitives styled to DESIGN.md: user bubble, assistant bubble, typing dots, tool-call fallback with "Pin to panel", empty state. |
| `components/` | `TraceyChatPanel`, `TraceyComposer` (Enter-to-send, `/` slash menu), `SlashMenu`, `ToolChips`, `ArtifactPanel`, `MarkdownText`, `artifacts/` renderers. |
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
5. Results stream back; `TraceyConversation` renders assistant Markdown, tool fallbacks, and
   any artifacts the `show_*` tools pushed into the panel.

## Tools: read, write, and artifact

- **Read tools** (`list_*`, `get_*`, `get_*_stats`) call `src/api/*.ts` and return data.
  `confirm: false`.
- **Write tools** (`start_test_run`, `set_proposal_status`) set `confirm: true`. They call
  `ctx.confirm(summary)` **before** mutating. `useTraceyChat` resolves that promise: when
  auto-approve is OFF it shows an inline Confirm/Cancel card; when ON it resolves `true`
  immediately. A declined write returns the `CANCELLED` sentinel — never call the mutating API
  on cancel.
- **Artifact tools** (`show_chart`, `show_table`, `show_text`) don't return data to chat; they
  call `ctx.showArtifact(...)` to render in the right panel and return `{ shown, title }`.

`TraceyToolContext` (`{ projectId, navigate, confirm, showArtifact }`) is built in
`useTraceyChat` and passed to both `createTraceyTools` (for `execute`) and the SDK tool adapter.

## Adding or changing a tool (checklist)

1. Add/edit the entry in `createTraceyTools` (`tracey-tools.ts`): `description`, `parameters`
   (zod), `confirm`, `execute`. Reuse an existing `src/api/*.ts` service in `execute` — don't
   add a bespoke fetch.
2. Add/update its entry in `TRACEY_TOOLS_META` so it appears in the slash menu.
3. If it's a write, set `confirm: true` and gate the mutation behind `ctx.confirm(...)`,
   returning `CANCELLED` when declined.
4. If it renders output, push a `TraceyArtifactInput` via `ctx.showArtifact` instead of
   dumping JSON in chat.
5. If the tool changes what Tracey can do, update `TRACEY_SYSTEM_PROMPT` so she knows about it.
6. No backend change is required for the tool contract — attribution is by name, and the
   version captures whatever tools go over the wire.

## Constraints & gotchas

- **`stopWhen` is mandatory** (see step 4). It's the difference between a working agent loop
  and silent tool-first turns.
- **Reasoning models send the system prompt under the `developer` role**, not `system`. That's
  a backend parser concern, but be aware her calls may look different on the wire.
- Hooks can't be conditional, so the runtime is created once with a `DelegatingTransport` and
  the real transport is swapped in after the session query resolves.
- All Tracey state lives in `useTraceyChat`; conversation/panel components stay presentational.
  Data fetching goes through TanStack Query (`api/tracey.ts`) — no raw `useEffect`/`fetch`.
- Styling follows DESIGN.md tokens, including the restyled assistant-ui primitives. File-size
  and component rules from BEST_PRACTICES.md apply — split tool UIs into `components/` if a
  file approaches the cap.

## Keep the manual in sync

User-facing behavior is documented in `manual/guide/tracey.md`. Per `CLAUDE.md`, a Tracey
feature change isn't complete until that page matches.
