# Tracey Tool-Result Store-and-Reference — Design

**Date:** 2026-06-04
**Status:** Approved (pending spec review)
**Area:** `frontend/src/features/tracey`

## Problem

Tracey is an in-browser AI chat agent. Its tools execute client-side
(`tracey-runtime.ts` → `createTraceyTools`) and the value each tool returns does
double duty:

1. It is fed back into the model context as the tool result on the next step of
   the turn (see `TraceyTransport.sendMessages` → `streamText` tool loop).
2. It is rendered inline in the chat by the matching tool-UI component
   (`components/tool-ui/registry.ts` → `TRACEY_TOOL_UI`), which reads the raw
   `result` directly.

Several tools return large payloads — full agent lists, full captured traces
(entire conversations), stats time-series, and the plot/table/text data the
visualization tools echo back. Because the result is fed to the model, every one
of these inflates context on each subsequent step, making turns slow and
expensive. The data is needed by the **UI**, not (in full) by the **model**.

## Goal

Keep the rich data available to the UI while sending the model only a small
digest plus a reference. Large payloads move to browser storage (IndexedDB);
tools return a compact envelope `{ artifactRef, kind, summary }`. UI cards
resolve the reference and render the full blob; their appearance is unchanged.

Secondary benefit: the persisted thread snapshot (localStorage, see
`tracey-storage.ts`) shrinks too, since it now stores envelopes rather than full
results.

## Non-goals

- No change to the visible UI of any tool card.
- No server-side storage; this is entirely client-side.
- No precise garbage collection of orphaned blobs (see Known Limitations).
- No change to write tools, navigation, docs search, skill loading, or the
  human-in-the-loop `ask_questions` tool.

## Architecture

### Envelope

A tool that stores its payload returns:

```ts
interface ArtifactEnvelope<S = unknown> {
  artifactRef: string; // random uuid, key into the artifact store
  kind: string;        // e.g. 'agent-list', 'trace', 'chart' — aids UI/debug
  summary: S;          // compact, model-facing digest
}
```

The envelope is what the model sees and what the thread snapshot persists. The
full payload lives only in IndexedDB.

### `tracey-artifact-store.ts` (new)

Module-level async functions, mirroring the style of `tracey-storage.ts` (plain
functions, not a class — the frontend has no DI):

- `putArtifact(record: ArtifactRecord): Promise<void>` — write to IndexedDB.
- `getArtifact(id: string): Promise<unknown | null>` — read full data.
- `clearArtifacts(scope: string): Promise<void>` — delete every blob for a
  user+project scope.
- `storeArtifact(scope, kind, full, summary): Promise<ArtifactEnvelope>` —
  generates a uuid, writes `{ id, scope, kind, data: full }`, returns the
  envelope. Convenience used by the tools.

```ts
interface ArtifactRecord {
  id: string;
  scope: string;   // `${userKey}:${projectKey}`
  kind: string;
  data: unknown;
}
```

IndexedDB: one database (e.g. `proxytrace.tracey`), one object store
(`artifacts`) keyed by `id`, with an index on `scope` so `clearArtifacts` can
delete a scope's records. All operations are best-effort: a failed read/write
degrades gracefully (card shows error/empty), never throws into the runtime —
matching the swallow-and-continue posture of `tracey-storage.ts`.

### `useArtifact.ts` (new)

A hook resolving a reference to its full payload via TanStack Query (already the
app's data layer):

```ts
function useArtifact<T>(refId: string | undefined):
  { data: T | undefined; status: 'pending' | 'error' | 'ready' };
```

Implemented with `useQuery({ queryKey: ['tracey-artifact', refId], queryFn: () =>
getArtifact(refId), enabled: !!refId })`. The status maps onto the existing
`toolUiState` helper, so cards reuse their current pending skeletons and error
states.

### `tracey-tools.ts` changes

- Add `artifactScope: string` to `TraceyToolContext`.
- In-scope tools `await storeArtifact(ctx.artifactScope, kind, full, summary)`
  and return the envelope instead of the raw payload.
- Per-tool summaries:
  - **Visualization** (`show_chart`, `show_table`, `show_text`): full = the
    artifact object the tool builds today; summary = `{ kind, title }`. The model
    supplied the data, so it needs nothing back.
  - **Lists** (`list_agents`, `list_suites`, `list_runs`, `list_proposals`):
    full = the array; summary = `{ count, items: [{ id, name }] }` (title field
    per entity). The model picks an item and drills in via the matching `get_*`.
  - **Single-gets** (`get_agent`, `get_suite`, `get_run`, `get_proposal`,
    `get_provider`, `get_trace`): full = the fetched object; summary = curated key
    fields, e.g.
    - agent → `{ id, name, endpointName, toolCount, systemPromptPreview }`
    - trace → `{ id, model, status, totalTokens, cost, latencyMs }`
    - run → `{ id, status, passRate, ... }`
    - proposal → `{ id, kind, status, priority }`
    - provider → `{ id, name, ... }`
    - suite → `{ id, name, caseCount }`
    (exact fields finalized against each DTO during implementation)
  - **Stats** (`get_dashboard_stats`, `get_agent_stats`): full = the whole
    object (incl. the `counts` time-series); summary = the `summary`/aggregate
    block only.
- Tool descriptions updated to state that the tool returns a compact digest plus
  a reference, that the full result is rendered to the user as a card, and that
  the model should call the relevant `get_*` to inspect a single item rather than
  expecting full data in the result.
- Small / control results stay inline (no store): `notFound`, `cancelled`
  (`CANCELLED`), and error outcomes. UI cards must therefore handle a result that
  has **no** `artifactRef` (treat as inline) as well as one that does.

### Tool-UI components (15)

Each in-scope component currently reads `result` directly. Change to: read
`result.artifactRef`; if present, resolve via `useArtifact` and render the full
blob using the resolved data; while resolving, show the existing pending
skeleton; if absent (inline result like `notFound`), render as today. Visual
output is unchanged.

Affected: `ChartToolUI`, `TableToolUI`, `TextToolUI`, `AgentListToolUI`,
`SuiteListToolUI`, `RunListToolUI`, `ProposalListToolUI`, `AgentCardToolUI`,
`SuiteCardToolUI`, `RunCardToolUI`, `ProposalCardToolUI`, `ProviderCardToolUI`,
`TraceCardToolUI`, `DashboardStatsToolUI`, `AgentStatsToolUI`.

### `useTraceyChat.ts` changes

- Build `artifactScope = \`${userKey}:${projectKey}\`` and pass it in the
  `toolContext` memo.
- `clear()` additionally calls `clearArtifacts(artifactScope)` so resetting the
  thread also frees its blobs.

## Data flow

1. `execute` runs in the browser, fetches/builds the full payload.
2. `storeArtifact` writes the blob to IndexedDB (awaited) and returns the
   envelope.
3. The SDK feeds the envelope to the model; the thread snapshot persists the
   envelope to localStorage.
4. The tool-UI card reads `artifactRef`, `useArtifact` reads the blob from
   IndexedDB, the card renders the full data.
5. On reload, the thread restores envelopes from localStorage and the blobs are
   still in IndexedDB, so cards re-resolve. On `clear()`, blobs are wiped.

## Error handling

- Storage is tiered: `putArtifact`/`getArtifact` prefer IndexedDB and fall back
  to localStorage (so the token saving survives IndexedDB-disabled environments
  such as Firefox private browsing); reads check both backends. Only if both
  backends fail to store does `tracey-tools` drop to returning the payload inline
  (correct, but costs model context). `clearArtifacts` wipes both backends.
- A missing blob (`getArtifact` → null), e.g. after a partial clear or an
  eviction, renders the card's error/empty state.

## Testing

- Add `fake-indexeddb` as a devDependency (jsdom has no IndexedDB); import its
  auto-register entry in the relevant spec/setup so the real IndexedDB API path
  is exercised.
- New `tracey-artifact-store.spec.ts`: put/get round-trip, `clearArtifacts`
  scoping (only the given scope is removed), missing-key returns null.
- Update `tracey-tools.spec.ts`: in-scope tools return an envelope with
  `artifactRef` + expected `summary`; the full payload is retrievable via
  `getArtifact`; out-of-scope tools and the `notFound`/`cancelled` paths are
  unchanged.
- Existing tool-UI behavior is covered by the unchanged rendered output; add
  focused tests only where the resolve path needs guarding.

## Disposal

- **Explicit clear:** the "New conversation" action calls `clearArtifacts(scope)`,
  wiping every blob for the user+project from both backends.
- **Mount-time GC:** on mount, `useTraceyChat` collects the artifact references in
  the restored thread snapshot (`collectArtifactRefs`) and calls
  `pruneArtifacts(scope, liveRefs)`, deleting any scope blob the thread no longer
  references. This disposes of orphans left by a replaced thread, a failed
  restore, or a write whose snapshot never persisted. Within a live thread every
  tool result stays in the snapshot, so its blob remains referenced — there are
  no live-session orphans to collect. GC runs only at mount: pruning mid-stream
  could race a just-written blob whose reference is not yet persisted and delete a
  live one.

## Known limitations (YAGNI)

- A very long single thread keeps every blob it references (correct — the cards
  need them); there is no per-scope size cap initially. Under the localStorage
  fallback this can hit the ~5MB origin quota, at which point new writes drop to
  the inline path. A cap/LRU can be added later if needed.

## Side checks

- `tracey-prompt.ts`: add a brief note describing the digest+reference behavior
  if the system prompt currently implies tools return full data.
- `manual/guide/tracey.md`: user-visible behavior is unchanged (turns are just
  cheaper/faster); update only if the page documents tool result internals.

## Files

**New**
- `frontend/src/features/tracey/tracey-artifact-store.ts`
- `frontend/src/features/tracey/useArtifact.ts`
- `frontend/src/features/tracey/tracey-artifact-store.spec.ts`

**Modified**
- `frontend/src/features/tracey/tracey-tools.ts`
- `frontend/src/features/tracey/useTraceyChat.ts`
- `frontend/src/features/tracey/tracey-tools.spec.ts`
- the 15 tool-UI components listed above
- `frontend/src/features/tracey/tracey-prompt.ts` (conditional)
- `frontend/package.json` (+`fake-indexeddb` devDep)
</content>
</invoke>
