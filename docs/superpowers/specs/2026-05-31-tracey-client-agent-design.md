# Tracey — the Proxytrace Client Agent (Design Spec)

**Issue:** #124 · **Date:** 2026-05-31 · **Status:** Approved for planning

## 1. Summary

Tracey is a conversational, in-app AI assistant living in a persistent right-side
chat drawer. She understands natural-language intent, reads Proxytrace's state,
navigates the user, and executes a curated set of actions (start a test run,
approve/refuse a proposal) on the user's behalf. Tracey is modelled as a per-project
**system `Agent`** (`IsSystemAgent = true`); her own LLM calls are routed back through
Proxytrace's OpenAI-compatible proxy and captured as `AgentCall`s — making her the
first dogfood agent of the platform.

This spec covers the MVP scope of issue #124. Out-of-scope items (entity
creation/editing, Tracey-driven optimization, custom evaluator authoring,
multi-project Tracey, server-side conversation persistence, voice) remain v2
candidates and are not designed here.

## 2. Decisions (locked during brainstorming)

These four decisions resolve ambiguities / gaps discovered in the codebase and
override the issue text where noted:

1. **Short-lived credential — add `ExpiresAt` to `ApiKey`.** `ApiKeyEntity` has no
   expiry today. We add a nullable `ExpiresAt` to the domain entity, storage entity,
   and a migration; the proxy enforces it. (`null` = never expires, backward
   compatible.)
2. **Browser → LLM transport — add CORS to `Proxytrace.Proxy`.** The proxy is a
   separate service with no CORS policy. The browser AI runtime calls it directly, so
   we add a config-driven CORS policy for the frontend origin.
3. **Tool schemas — hand-written, single TS source.** No DTO→TS codegen pipeline
   exists. Tool schemas are authored once in `tracey-tools.ts`; the seeder mirrors the
   same shape onto `Agent.Tools`. **This relaxes AC-BE-3** (which asked for generated
   types / no hand-duplication).
4. **Chat framework — assistant-ui** (`@assistant-ui/react` +
   `@assistant-ui/react-ai-sdk`) on top of the Vercel AI SDK, with **inline
   visualization reusing `lib/charts.ts` + `KpiCard`** (no new chart dependency).
   **This supersedes AC-UI-2's literal reuse of `MessageBubble`/`ToolMessageBubble`**
   in the drawer — assistant-ui supplies its own thread/message primitives (styled to
   DESIGN.md tokens). Those bubbles are reused only where convenient inside tool UIs.

## 3. Architecture & data flow

```
Browser (React, assistant-ui runtime over Vercel AI SDK)
  │
  │  (1) GET /api/tracey/session          [same origin, JWT]
  │         ─────────────────────────────► Main API · TraceySessionService
  │         ◄───────────────────────────── { apiKey (TTL ≤ 1h), proxyBaseUrl, model, agentId }
  │
  │  (2) POST {proxyBaseUrl}/{project}/openai/v1/chat/completions
  │         [Bearer = short-lived key]
  │         ─────────────────────────────► Proxytrace.Proxy
  │                                           · resolve key (reject if ExpiresAt < now)
  │                                           · swap in provider's real key
  │                                           · forward upstream LLM
  │                                           · async ingest ─► AgentCall matched to Tracey agent
  │
  │  (3) tool calls execute CLIENT-SIDE     [same origin, JWT]
  │         ─────────────────────────────► existing src/api/*.ts services
  ▼
```

**Two planes.** The **LLM reasoning** plane hits the *Proxy service* with the
short-lived key (so every reasoning step is captured as an `AgentCall`). The
**tool/data** plane runs in the browser and hits the *main API* same-origin with the
user's existing JWT, reusing typed `src/api/*.ts` services. No new backend action
endpoints are required — tools reuse existing APIs.

**Observability (AC-OBS-1).** The proxy already ingests calls and matches them to an
agent via `AgentVersionMatcher` (system prompt + tools). Because Tracey's stored
`Agent` carries the same system prompt + tools her runtime uses, her calls
auto-attribute to the Tracey agent and appear in Traces, filterable by
`IsSystemAgent`. No special wiring beyond routing through the proxy.

## 4. Backend design

### 4.1 ApiKey TTL (`Proxytrace.Domain/ApiKey`, `Proxytrace.Storage`)

- Add `DateTimeOffset? ExpiresAt { get; }` to `IApiKey` and both factory delegates
  (`CreateNew`, `CreateExisting`), following the entity pattern (constructor chaining
  via `this(...)`, `base(existing)`).
- Add `DateTimeOffset? ExpiresAt { get; init; }` to `ApiKeyEntity`; map in
  `ApiKeyConfig` (Postgres `timestamptz null`).
- Update `ApiKeyGenerator` to populate `ExpiresAt` (default `null`).
- EF migration `AddApiKeyExpiresAt` (PostgreSQL-typed, nullable column).
- Validation: no new rule required (`null` is valid); existing keys unaffected.

### 4.2 Proxy expiry enforcement (`Proxytrace.Proxy`)

- `CachedApiKeyResolver`: after `FindByKeyAsync`, treat a key with
  `ExpiresAt < DateTimeOffset.UtcNow` as not found → the proxy returns 401.
- **Cache correctness:** when caching a resolved key, clamp the cache entry TTL to
  `min(configuredTtl, ExpiresAt - now)` so a short-lived key is never served from
  cache past its lifetime. Keys with `ExpiresAt == null` keep the configured TTL.
- Thread `ExpiresAt` through `ResolvedApiKey` if needed for the clamp.

### 4.3 CORS (`Proxytrace.Proxy/Program.cs`)

- Add a named CORS policy allowing the frontend origin (config key, e.g.
  `Cors:FrontendOrigin`, dev-defaulted), methods `POST, OPTIONS`, headers
  `Authorization, Content-Type`. Register before the proxy endpoint.

### 4.4 Session service (`Proxytrace.Application/Tracey`)

- `ITraceySessionService` (public) + internal `TraceySessionService`.
- `CreateSessionAsync(user, project, ct)`:
  - resolves the project's Tracey agent (must exist — seeded);
  - mints `IApiKey` via generator + `IApiKeyRepository.Add` with
    `Name = "tracey-session"`, `Project = project`,
    `Provider = project.SystemEndpoint.Provider`,
    `ExpiresAt = now + 1h`;
  - returns a result `{ apiKey, proxyBaseUrl, model, agentId }` where
    `proxyBaseUrl` comes from configuration (`Tracey:ProxyBaseUrl`, dev-defaulted),
    `model = project.SystemEndpoint.Model.Name`, `agentId = traceyAgent.Id`.
- Register in `Proxytrace.Application.Module`.

### 4.5 Controller (`Proxytrace.Api/Controllers/TraceyController.cs`)

- `GET /api/tracey/session` — JWT-authed; resolves current user + active project from
  the existing project-context mechanism used by sibling controllers; returns a
  `TraceySessionDto` mirroring the service result.

### 4.6 Tracey agent seeder (`Proxytrace.Application/Tracey/Internal`)

- `TraceyAgentSeeder` hosted service, runs after the database is ready (sequenced like
  `DemoSeederHostedService`).
- For each project lacking a `Name = "Tracey"` system agent, create one via
  `IAgent.CreateNew("Tracey", traceySystemPrompt, TraceyTools, project.SystemEndpoint,
  project, defaultParams, isSystemAgent: true)`. Idempotent (guard on existing Tracey
  agent).
- **New-project hook:** invoke the same idempotent seed in the project-creation path
  so newly created projects get Tracey immediately.
- Constants `TraceyPrompt` (system prompt) and `TraceyTools`
  (`IReadOnlyList<ToolSpecification>`) defined once in a single file; the tool shapes
  mirror `tracey-tools.ts` (§5.2).

## 5. Frontend design (`frontend/`)

### 5.1 Packages

Add `@assistant-ui/react`, `@assistant-ui/react-ai-sdk`, `ai`, `@ai-sdk/openai`.

### 5.2 Feature folder `src/features/tracey/`

- **`tracey-tools.ts`** — single source of truth. Array of tool definitions
  `{ name, description, parameters (zod/JSON schema), execute }`. `execute` handlers
  call existing `src/api/*.ts` services or the client-side `navigate` action.
  Confirm-gated tools (`start_test_run`, `set_proposal_status`) do **not** call the
  API directly; they yield a "pending confirmation" result the tool UI renders as a
  Confirm/Cancel card, and the real API call fires on confirm.
- **`useTraceyChat.ts`** — the only stateful hook. Fetches the session
  (TanStack Query via `api/tracey.ts`), builds an assistant-ui runtime over the AI SDK
  adapter pointed at `proxyBaseUrl` with the session key, registers the tool set,
  exposes the Auto-approve flag and Clear action. Handles 401 mid-chat by refetching
  the session once and retrying; surfaces a chat error on repeat failure.
- **`TraceyDrawer.tsx`** — `Drawer` shell wrapping content in
  `AssistantRuntimeProvider`. Header: title "Tracey", **Auto-approve toggle**
  (default OFF), **Clear conversation**. Composer = assistant-ui `Composer`
  (Enter-to-send / Shift+Enter newline).
- **`TraceyConversation.tsx`** — assistant-ui `Thread` primitives styled to DESIGN.md
  tokens; registers per-tool UIs (`makeAssistantToolUI`): read tools render result
  previews + inline mini-charts (`lib/charts.ts`) + "Open full view" deep-links; write
  tools render the Confirm/Cancel card. Reuses `KpiCard`, `Pill`, `ProgressBar`,
  `EmptyState`.
- **`tracey-storage.ts`** — `localStorage` round-trip of the thread, keyed by
  `user + project`; restored as initial messages on mount; Clear resets.

### 5.3 Shared / shell

- **`src/api/tracey.ts`** — typed `getTraceySession()` for `GET /api/tracey/session`.
- **`src/api/query-keys.ts`** — add the Tracey session key.
- **`src/components/layout/Shell.tsx`** — add a toggle button to the top-bar cluster
  (near health/search/avatar) and mount `TraceyDrawer` once. Drawer open state lifts
  to the shell so the conversation persists across navigation.

### 5.4 BEST_PRACTICES conformance

Tool defs are data; drawer/conversation are presentational; `useTraceyChat` holds the
only state. Data fetching goes through TanStack Query (`api/tracey.ts`); no raw
`useEffect`/`fetch`. Files stay within size limits (split tool UIs into small
components if a file approaches the cap). DESIGN.md tokens for all styling, including
restyled assistant-ui primitives.

## 6. Tool catalogue

| Tool | Backing | Confirm? |
|------|---------|----------|
| `navigate` | client-side React Router `useNavigate` | no |
| `list_agents` / `get_agent` | `agentsApi` | no |
| `list_suites` / `get_suite` | `testSuitesApi` | no |
| `list_runs` / `get_run` | `testRunsApi` | no |
| `list_proposals` / `get_proposal` | `proposalsApi` | no |
| `get_dashboard_stats` / `get_agent_stats` | `statisticsApi` | no |
| `start_test_run` | `testRunGroupsApi.create` + SSE progress via `event-stream.ts` | **yes** |
| `set_proposal_status` | `proposalsApi.updateStatus` | **yes** |

The stored `Agent.Tools` copy mirrors these definitions (hand-kept, single TS source).

## 7. Error handling & confirmation UX

- **Auto-approve OFF (default)** gates every write tool behind an inline Confirm/Cancel
  card showing the action summary (suite + endpoint for runs; proposal summary for
  status changes). Auto-approve ON fires writes without the card.
- **Session expiry (401 from proxy mid-chat):** refetch session once, retry; on repeat
  failure surface an error bubble.
- **Ambiguity (AC-CONV-5):** a tool may return a "needs clarification" result (e.g.
  multiple agent-name matches); Tracey asks rather than guessing.
- **Tool/API failure:** error rendered in the tool bubble; conversation continues.
- **NFR-3:** no upstream provider credential ever reaches the browser — only the
  short-lived Proxytrace key.

## 8. Testing

**Backend (`BaseTest<Module>`):**
- `TraceySessionService`: minted key scoped to the right project + provider; `ExpiresAt
  ≈ now + 1h`; returns the correct `agentId`, `model`, `proxyBaseUrl`.
- `TraceyAgentSeeder`: every project ends with exactly one Tracey agent,
  `IsSystemAgent = true`, canonical system prompt + tool list; re-run is idempotent.
- ApiKey TTL: a key past `ExpiresAt` is rejected at resolve time.

**Proxy:** expired short-lived key → 401; valid key passes and forwards.

**Frontend (Vitest):** tool handlers call the right API services with the right
shapes; `tracey-storage` round-trips; the Confirm card gates write tools when
Auto-approve is OFF and bypasses when ON.

**Manual (`./dev.sh`)** — issue #124 E2E checklist: list agents; token-usage chart +
deep-link; run-a-suite confirm → stream progress; approve-proposal confirm → status
reflected in Proposals tab; Auto-approve ON skips confirms; Tracey's calls appear in
Traces attributed to the Tracey system agent.

**Build gates:** `dotnet build Proxytrace.sln`, `dotnet test Proxytrace.sln`,
`cd frontend && npm run build && npm run lint && npm test`,
`cd manual && npm run docs:build`.

## 9. Documentation

Add `manual/guide/tracey.md` (end-user guide: opening the drawer, asking questions,
running actions, Auto-approve, where her traces show up) and wire it into the sidebar
in `manual/.vitepress/config.ts`. Per CLAUDE.md, the feature is not complete until the
manual matches.

## 10. Deviations from issue #124 (explicit)

- **AC-BE-3** relaxed: hand-written tool schemas with a single TS source mirrored onto
  `Agent.Tools`; no DTO→TS codegen pipeline.
- **AC-UI-2** superseded: assistant-ui supplies the thread/message/composer primitives
  (styled to DESIGN.md tokens) instead of `MessageBubble`/`ToolMessageBubble`.
- **ApiKey TTL** is new schema + proxy enforcement, not pure reuse of the existing
  key-minting path.
- **Proxy CORS** is newly added to `Proxytrace.Proxy`.

## 11. Critical files

**Backend — create:** `Proxytrace.Api/Controllers/TraceyController.cs`;
`Proxytrace.Application/Tracey/ITraceySessionService.cs`;
`Proxytrace.Application/Tracey/Internal/TraceySessionService.cs`;
`Proxytrace.Application/Tracey/Internal/TraceyAgentSeeder.cs`;
constants file for `TraceyPrompt` + `TraceyTools`; migration `AddApiKeyExpiresAt`.

**Backend — modify:** `Proxytrace.Domain/ApiKey/IApiKey.cs` (+ internal `ApiKey`,
generator); `Proxytrace.Storage/Internal/Entities/ApiKey/{ApiKeyEntity,ApiKeyConfig}.cs`;
`Proxytrace.Proxy/Internal/CachedApiKeyResolver.cs`; `Proxytrace.Proxy/Program.cs`;
`Proxytrace.Application/Module.cs`; project-creation path (new-project seed hook).

**Frontend — create:** `src/features/tracey/{TraceyDrawer,TraceyConversation}.tsx`,
`src/features/tracey/{useTraceyChat,tracey-tools,tracey-storage}.ts`,
`src/api/tracey.ts`.

**Frontend — modify:** `src/components/layout/Shell.tsx`, `src/api/query-keys.ts`,
`frontend/package.json`.

**Manual — create:** `manual/guide/tracey.md` + sidebar entry in
`manual/.vitepress/config.ts`.

**Reused:** `Proxytrace.Domain/Agent/*`, `Proxytrace.Domain/ApiKey/*`,
`Proxytrace.Application/Streaming/*`, `frontend/src/components/overlays/Drawer.tsx`,
`frontend/src/lib/charts.ts`, `KpiCard`/`Pill`/`ProgressBar`/`EmptyState`, all
`frontend/src/api/*.ts` services.
